import { randomUUID } from "node:crypto";
import { canal_notificacion, estado_cita, tipo_notificacion } from "@/generated/prisma/enums";
import { config } from "@/config";
import { prisma } from "@/lib/prisma";

const DIA = 24 * 60 * 60_000;
export const ASUNTO_RESUMEN = "Resumen de tus sesiones de hoy";

const horaCorta = (fecha: Date, zona: string) =>
  fecha.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: zona });

/**
 * Resumen diario (lo dispara un cron a las 8 p.m.): a cada psicóloga con correo
 * activado le llega UN correo si alguna sesión de las últimas 24 h quedó sin
 * cerrar o sin bitácora. Si no hay pendientes, no se manda nada.
 *
 * Solo nombre y hora: nada de notas ni motivos (es correo, se reenvía).
 * Idempotente: si ya se encoló el resumen en las últimas 20 h, no repite.
 * Devuelve cuántos correos encoló; los envía el despachador de la cola.
 */
export async function encolarResumenBitacora(ahora = new Date()): Promise<number> {
  const desde = new Date(ahora.getTime() - DIA);
  const psicologas = await prisma.psicologos.findMany({
    where: { usuarios: { notificar_correo: true, activo: true } },
    select: { id: true, usuarios: { select: { id: true, zona_horaria: true } } },
  });

  let encolados = 0;
  for (const psicologa of psicologas) {
    const yaEnviado = await prisma.notificaciones.findFirst({
      where: {
        usuario_id: psicologa.usuarios.id,
        asunto: ASUNTO_RESUMEN,
        creado_en: { gte: new Date(ahora.getTime() - 20 * 60 * 60_000) },
      },
      select: { id: true },
    });
    if (yaEnviado) continue;

    const citas = await prisma.citas.findMany({
      where: {
        psicologo_id: psicologa.id,
        fin: { gt: desde, lte: ahora },
        OR: [
          { estado: { in: [estado_cita.CONFIRMADA, estado_cita.PENDIENTE] } },
          { estado: estado_cita.COMPLETADA, entradas_bitacora: { none: {} } },
        ],
      },
      select: { inicio: true, estado: true, pacientes: { select: { usuarios: { select: { nombre_completo: true } } } } },
      orderBy: { inicio: "asc" },
    });
    if (citas.length === 0) continue;

    const zona = psicologa.usuarios.zona_horaria || "America/Mazatlan";
    const linea = (c: (typeof citas)[number]) =>
      `• ${horaCorta(c.inicio, zona)} · ${c.pacientes.usuarios.nombre_completo}`;
    const sinCerrar = citas.filter((c) => c.estado !== estado_cita.COMPLETADA);
    const sinBitacora = citas.filter((c) => c.estado === estado_cita.COMPLETADA);
    const partes = [
      sinCerrar.length > 0 && `Sin cerrar (marca si asistieron):\n${sinCerrar.map(linea).join("\n")}`,
      sinBitacora.length > 0 && `Sin bitácora:\n${sinBitacora.map(linea).join("\n")}`,
    ].filter(Boolean);

    await prisma.notificaciones.create({
      data: {
        id: randomUUID(),
        usuario_id: psicologa.usuarios.id,
        tipo: tipo_notificacion.RECORDATORIO,
        canal: canal_notificacion.CORREO,
        asunto: ASUNTO_RESUMEN,
        mensaje: `Te quedaron pendientes de hoy:\n\n${partes.join("\n\n")}\n\nCiérralas desde tu inicio: ${config.webUrl}/dashboard`,
        programada_para: ahora,
      },
    });
    encolados += 1;
  }
  return encolados;
}
