import { prisma } from "@/lib/prisma";
import { limpiarCacheRegistroVencida } from "@/services/codigo-cache.repo";

/**
 * Retención de los datos operativos.
 *
 * Son las únicas tablas que la purga toca: `notificaciones`, `solicitudes_cita`
 * y `cache_registro`. Los datos clínicos y de negocio (expedientes, citas, pagos,
 * consentimientos, bitácoras, tutores y usuarios) quedan fuera por diseño: su
 * conservación es una decisión legal, no técnica. Por eso no existe una regla
 * genérica del tipo «borrar lo anterior a N meses»; la lista blanca es explícita.
 *
 * Las ventanas viven como constantes y no como variables de entorno: menos
 * superficie de configuración y pruebas más simples. Si algún día hace falta
 * ajustarlas sin desplegar, se migran a variables con estos mismos valores.
 */
export const RETENCION = {
  /** Avisos ya entregados (ENVIADA) o agotados (FALLIDA). */
  notificacionesEnviadasDias: 90,
  /** Recordatorios reemplazados que quedaron cancelados. */
  notificacionesCanceladasDias: 7,
  /** Solicitudes que siguen PENDIENTE y cuya fecha ya pasó. */
  solicitudesVencidasDias: 30,
  /** Solicitudes RECHAZADA/CANCELADA sin cita asociada. */
  solicitudesTerminalesMeses: 12,
} as const;

/** Filas por sentencia. Acota el tiempo de cada ejecución. */
export const LOTE_PURGA = 1_000;

/**
 * Tope de lotes por tabla y ejecución. Si queda trabajo, la siguiente corrida
 * del cron continúa: el endpoint debe terminar muy por debajo de los 30 s.
 */
export const MAX_LOTES_PURGA = 10;

export interface ResultadoPurga {
  /** Filas eliminadas por tabla. */
  eliminadas: {
    notificaciones: number;
    solicitudes_cita: number;
    cache_registro: number;
  };
  /** Solicitudes PENDIENTE vencidas que pasaron a CANCELADA. */
  solicitudesExpiradas: number;
  /** Tamaño lógico de la base al terminar, para comparar entre ejecuciones. */
  tamanoBaseBytes: number;
}

/**
 * Repite un borrado por lotes hasta que una vuelta devuelva menos filas que el
 * lote o se alcance el tope. Así una tabla con mucho atraso no bloquea la
 * función de Vercel ni el disparador externo.
 */
async function borrarPorLotes(
  sentencia: (lote: number) => Promise<{ id: string }[]>,
): Promise<number> {
  let total = 0;

  for (let vuelta = 0; vuelta < MAX_LOTES_PURGA; vuelta++) {
    const filas = await sentencia(LOTE_PURGA);
    total += filas.length;
    if (filas.length < LOTE_PURGA) break;
  }

  return total;
}

/**
 * Notificaciones terminales vencidas.
 *
 * `PENDIENTE` es intocable sin importar su antigüedad: un recordatorio puede
 * llevar días en cola y seguir siendo válido (una cita futura reprogramada).
 * El filtro de estado se escribe con literales del enum para que el índice
 * `(estado, creado_en)` sea utilizable; no se pasan arreglos de enums desde
 * Prisma. `ctid` + `FOR UPDATE SKIP LOCKED` permite que dos purgas solapadas
 * avancen sin bloquearse; la condición por fecha hace el borrado idempotente.
 */
function purgarNotificaciones(lote: number) {
  return prisma.$queryRaw<{ id: string }[]>`
    WITH vencidas AS (
      SELECT ctid
        FROM notificaciones
       WHERE (
               (estado = 'ENVIADA'::estado_envio OR estado = 'FALLIDA'::estado_envio)
               AND creado_en < now() - make_interval(days => ${RETENCION.notificacionesEnviadasDias})
             )
          OR (
               estado = 'CANCELADA'::estado_envio
               AND creado_en < now() - make_interval(days => ${RETENCION.notificacionesCanceladasDias})
             )
       ORDER BY creado_en
       LIMIT ${lote}
       FOR UPDATE SKIP LOCKED
    )
    DELETE FROM notificaciones n
     USING vencidas
     WHERE n.ctid = vencidas.ctid
    RETURNING n.id
  `;
}

/**
 * Expira solicitudes que llevan más de 30 días pendientes y cuya fecha ya pasó:
 * pasan a CANCELADA para que dejen de ocupar la cola de atención. El CHECK
 * `ck_solicitudes_atendida` exige `atendida_en` en todo estado terminal.
 */
function expirarSolicitudes(lote: number) {
  return prisma.$queryRaw<{ id: string }[]>`
    WITH vencidas AS (
      SELECT ctid
        FROM solicitudes_cita
       WHERE estado = 'PENDIENTE'::estado_solicitud
         AND creado_en < now() - make_interval(days => ${RETENCION.solicitudesVencidasDias})
         AND inicio_solicitado < now()
       ORDER BY creado_en
       LIMIT ${lote}
       FOR UPDATE SKIP LOCKED
    )
    UPDATE solicitudes_cita s
       SET estado = 'CANCELADA'::estado_solicitud,
           atendida_en = now()
      FROM vencidas
     WHERE s.ctid = vencidas.ctid
    RETURNING s.id
  `;
}

/**
 * Solicitudes terminales antiguas sin cita asociada. La comprobación de `citas`
 * es deliberada: una solicitud que produjo una cita forma parte de la historia
 * de negocio y no se elimina, aunque su estado sea CANCELADA o RECHAZADA.
 */
function purgarSolicitudes(lote: number) {
  return prisma.$queryRaw<{ id: string }[]>`
    WITH vencidas AS (
      SELECT s.ctid
        FROM solicitudes_cita s
       WHERE s.estado IN ('RECHAZADA'::estado_solicitud, 'CANCELADA'::estado_solicitud)
         AND s.creado_en < now() - make_interval(months => ${RETENCION.solicitudesTerminalesMeses})
         AND NOT EXISTS (SELECT 1 FROM citas c WHERE c.solicitud_id = s.id)
       ORDER BY s.creado_en
       LIMIT ${lote}
       FOR UPDATE SKIP LOCKED
    )
    DELETE FROM solicitudes_cita s
     USING vencidas
     WHERE s.ctid = vencidas.ctid
    RETURNING s.id
  `;
}

/**
 * Purga de datos operativos vencidos. Idempotente: dos ejecuciones seguidas
 * sobre el mismo estado dejan la segunda sin trabajo.
 */
export async function purgarDatosVencidos(): Promise<ResultadoPurga> {
  // Primero se expira, para que una solicitud vieja sin cita pueda entrar en el
  // borrado de terminales de la misma ejecución.
  const solicitudesExpiradas = await borrarPorLotes(expirarSolicitudes);

  const notificaciones = await borrarPorLotes(purgarNotificaciones);
  const solicitudes_cita = await borrarPorLotes(purgarSolicitudes);
  const cache_registro = await limpiarCacheRegistroVencida();

  const tamano = await prisma.$queryRaw<{ bytes: bigint }[]>`
    SELECT pg_database_size(current_database()) AS bytes
  `;
  const bytes = tamano[0]?.bytes ?? 0n;

  return {
    eliminadas: { notificaciones, solicitudes_cita, cache_registro },
    solicitudesExpiradas,
    tamanoBaseBytes: Number(bytes),
  };
}
