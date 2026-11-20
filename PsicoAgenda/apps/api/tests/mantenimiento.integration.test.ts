import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { purgarDatosVencidos } from "@/services/mantenimiento.service";
import {
  canal_notificacion,
  estado_envio,
  estado_solicitud,
  modalidad_cita,
  rol_usuario,
  tipo_notificacion,
  tipo_sesion,
} from "@/generated/prisma/enums";

// El correo se sustituye: esta suite verifica la base, no el proveedor.
vi.mock("@/services/mailer.service", () => ({ enviarCorreoNotificacion: vi.fn() }));

const { notificar } = await import("@/services/notification.service");

/**
 * Pruebas de la purga contra la base de datos real de desarrollo.
 *
 * Verifican lo que los mocks no pueden: que el SQL por lotes borra solo la
 * lista blanca de tablas operativas, que respeta los datos clínicos y que dos
 * ejecuciones solapadas no se bloquean ni duplican borrados.
 */
const TAG = `mantenimiento-${randomUUID()}`;
const DIA = 86_400_000;

const diasAtras = (dias: number) => new Date(Date.now() - dias * DIA);
const diasAdelante = (dias: number) => new Date(Date.now() + dias * DIA);
const mesesAtras = (meses: number) => {
  const fecha = new Date();
  fecha.setUTCMonth(fecha.getUTCMonth() - meses);
  return fecha;
};

const ids = {
  pacienteUsuario: randomUUID(),
  psicologoUsuario: randomUUID(),
  paciente: randomUUID(),
  psicologo: randomUUID(),
  expediente: randomUUID(),
  cita: randomUUID(),
  pago: randomUUID(),
  consentimiento: randomUUID(),
  bitacora: randomUUID(),
  citaConSolicitud: randomUUID(),
  citaReprogramada: randomUUID(),
};

type AvisoEsperado = { id: string; etiqueta: string; sobrevive: boolean };

const avisos: AvisoEsperado[] = [];
const idsRecordatoriosViejos: string[] = [];

async function crearAviso(
  etiqueta: string,
  estado: estado_envio,
  creadoEn: Date,
  sobrevive: boolean,
) {
  const id = randomUUID();
  await prisma.notificaciones.create({
    data: {
      id,
      usuario_id: ids.pacienteUsuario,
      tipo: tipo_notificacion.CONFIRMACION,
      canal: canal_notificacion.SISTEMA,
      asunto: `${TAG}-${etiqueta}`,
      mensaje: "Aviso de prueba de la purga",
      estado,
      creado_en: creadoEn,
      enviada_en: estado === estado_envio.ENVIADA ? creadoEn : null,
    },
  });
  avisos.push({ id, etiqueta, sobrevive });
  return id;
}

async function crearSolicitud(estado: estado_solicitud, creadoEn: Date, inicio: Date, extra = {}) {
  const id = randomUUID();
  await prisma.solicitudes_cita.create({
    data: {
      id,
      paciente_id: ids.paciente,
      psicologo_id: ids.psicologo,
      inicio_solicitado: inicio,
      tipo_sesion: tipo_sesion.CONSULTA_INICIAL,
      estado,
      creado_en: creadoEn,
      atendida_en: estado === estado_solicitud.PENDIENTE ? null : creadoEn,
      ...extra,
    },
  });
  return id;
}

let solicitudPendienteVieja: string;
let solicitudPendienteFutura: string;
let solicitudPendienteReciente: string;
let solicitudTerminalSinCita: string;
let solicitudTerminalConCita: string;
let solicitudCanceladaReciente: string;

beforeAll(async () => {
  await prisma.usuarios.createMany({
    data: [
      {
        id: ids.pacienteUsuario,
        correo: `${TAG}-paciente@psicoagenda.test`,
        nombre_completo: "Paciente de mantenimiento",
        rol: rol_usuario.PACIENTE,
      },
      {
        id: ids.psicologoUsuario,
        correo: `${TAG}-psicologo@psicoagenda.test`,
        nombre_completo: "Psicólogo de mantenimiento",
        rol: rol_usuario.PSICOLOGO,
      },
    ],
  });

  await prisma.psicologos.create({
    data: {
      id: ids.psicologo,
      usuario_id: ids.psicologoUsuario,
      cedula_profesional: `LIC-${TAG}`,
    },
  });

  await prisma.pacientes.create({
    data: {
      id: ids.paciente,
      usuario_id: ids.pacienteUsuario,
      psicologo_id: ids.psicologo,
    },
  });

  await prisma.expedientes_clinicos.create({
    data: { id: ids.expediente, paciente_id: ids.paciente, motivo_consulta: "Prueba de purga" },
  });

  await prisma.citas.create({
    data: {
      id: ids.cita,
      paciente_id: ids.paciente,
      psicologo_id: ids.psicologo,
      inicio: diasAtras(400),
      fin: new Date(diasAtras(400).getTime() + 50 * 60_000),
      tipo_sesion: tipo_sesion.INDIVIDUAL,
    },
  });

  await prisma.pagos_honorarios.create({
    data: { id: ids.pago, cita_id: ids.cita, monto: 800 },
  });

  await prisma.consentimientos_informados.create({
    data: { id: ids.consentimiento, paciente_id: ids.paciente, documento: "Consentimiento de prueba" },
  });

  await prisma.entradas_bitacora.create({
    data: {
      id: ids.bitacora,
      expediente_id: ids.expediente,
      cita_id: ids.cita,
      psicologo_id: ids.psicologo,
      notas_sesion: "Nota clínica que la purga no debe tocar",
    },
  });

  // Notificaciones: solo las terminales vencidas deben desaparecer.
  await crearAviso("enviada-vencida", estado_envio.ENVIADA, diasAtras(91), false);
  await crearAviso("fallida-vencida", estado_envio.FALLIDA, diasAtras(120), false);
  await crearAviso("cancelada-vencida", estado_envio.CANCELADA, diasAtras(8), false);
  await crearAviso("pendiente-vieja", estado_envio.PENDIENTE, diasAtras(365), true);
  await crearAviso("enviada-reciente", estado_envio.ENVIADA, diasAtras(30), true);
  await crearAviso("cancelada-reciente", estado_envio.CANCELADA, diasAtras(3), true);

  await prisma.cache_registro.createMany({
    data: [
      { clave: `${TAG}-vencida`, valor: "1", expira_en: diasAtras(1) },
      { clave: `${TAG}-vigente`, valor: "1", expira_en: diasAdelante(1) },
    ],
  });

  // Solicitudes: la fecha vencida y la antigüedad deciden, no solo el estado.
  solicitudPendienteVieja = await crearSolicitud(
    estado_solicitud.PENDIENTE,
    diasAtras(40),
    diasAtras(5),
  );
  solicitudPendienteFutura = await crearSolicitud(
    estado_solicitud.PENDIENTE,
    diasAtras(40),
    diasAdelante(5),
  );
  solicitudPendienteReciente = await crearSolicitud(
    estado_solicitud.PENDIENTE,
    diasAtras(5),
    diasAtras(1),
  );
  solicitudTerminalSinCita = await crearSolicitud(
    estado_solicitud.RECHAZADA,
    mesesAtras(13),
    mesesAtras(13),
  );
  solicitudCanceladaReciente = await crearSolicitud(
    estado_solicitud.CANCELADA,
    mesesAtras(1),
    mesesAtras(1),
  );
  solicitudTerminalConCita = await crearSolicitud(
    estado_solicitud.CANCELADA,
    mesesAtras(13),
    mesesAtras(13),
  );
  await prisma.citas.create({
    data: {
      id: ids.citaConSolicitud,
      paciente_id: ids.paciente,
      psicologo_id: ids.psicologo,
      solicitud_id: solicitudTerminalConCita,
      inicio: mesesAtras(13),
      fin: new Date(mesesAtras(13).getTime() + 50 * 60_000),
      tipo_sesion: tipo_sesion.INDIVIDUAL,
    },
  });

  // Cita con recordatorios pendientes para el escenario de reprogramación.
  await prisma.citas.create({
    data: {
      id: ids.citaReprogramada,
      paciente_id: ids.paciente,
      psicologo_id: ids.psicologo,
      inicio: diasAdelante(3),
      fin: new Date(diasAdelante(3).getTime() + 50 * 60_000),
      tipo_sesion: tipo_sesion.INDIVIDUAL,
    },
  });
  for (let i = 0; i < 3; i++) {
    const id = randomUUID();
    idsRecordatoriosViejos.push(id);
    await prisma.notificaciones.create({
      data: {
        id,
        usuario_id: ids.pacienteUsuario,
        cita_id: ids.citaReprogramada,
        tipo: tipo_notificacion.RECORDATORIO,
        canal: canal_notificacion.SISTEMA,
        asunto: `${TAG}-recordatorio-viejo-${i}`,
        mensaje: "Recordatorio que se reemplaza al reprogramar",
        estado: estado_envio.PENDIENTE,
        programada_para: diasAdelante(2),
      },
    });
  }
});

afterAll(async () => {
  await prisma.notificaciones.deleteMany({ where: { usuario_id: ids.pacienteUsuario } });
  await prisma.entradas_bitacora.deleteMany({ where: { psicologo_id: ids.psicologo } });
  await prisma.pagos_honorarios.deleteMany({ where: { cita_id: ids.cita } });
  await prisma.citas.deleteMany({ where: { psicologo_id: ids.psicologo } });
  await prisma.solicitudes_cita.deleteMany({ where: { psicologo_id: ids.psicologo } });
  await prisma.consentimientos_informados.deleteMany({ where: { paciente_id: ids.paciente } });
  await prisma.expedientes_clinicos.deleteMany({ where: { paciente_id: ids.paciente } });
  await prisma.pacientes.deleteMany({ where: { id: ids.paciente } });
  await prisma.psicologos.deleteMany({ where: { id: ids.psicologo } });
  await prisma.usuarios.deleteMany({
    where: { id: { in: [ids.pacienteUsuario, ids.psicologoUsuario] } },
  });
  await prisma.cache_registro.deleteMany({ where: { clave: { startsWith: TAG } } });
  await prisma.notificaciones.deleteMany({ where: { asunto: { startsWith: TAG } } });
  await disconnectPrisma();
});

describe("purgarDatosVencidos", () => {
  let resultado: Awaited<ReturnType<typeof purgarDatosVencidos>>;
  let segunda: Awaited<ReturnType<typeof purgarDatosVencidos>>;

  it("elimina las notificaciones terminales vencidas y conserva las PENDIENTE", async () => {
    resultado = await purgarDatosVencidos();
    // Se ejecuta enseguida, antes de que otra prueba cree avisos nuevos: es la
    // comprobación de idempotencia sobre el mismo estado de la base.
    segunda = await purgarDatosVencidos();

    for (const aviso of avisos) {
      const existe = await prisma.notificaciones.findUnique({ where: { id: aviso.id } });
      if (aviso.sobrevive) {
        expect(existe, `${aviso.etiqueta} debía sobrevivir`).not.toBeNull();
      } else {
        expect(existe, `${aviso.etiqueta} debía eliminarse`).toBeNull();
      }
    }

    expect(resultado.eliminadas.notificaciones).toBeGreaterThanOrEqual(3);
    expect(resultado.tamanoBaseBytes).toBeGreaterThan(0);
  });

  it("reprogramar una cita deja exactamente los recordatorios nuevos y ninguno cancelado", async () => {
    const nuevoInicio = diasAdelante(5);

    await notificar("CITA_MODIFICADA", {
      citaId: ids.citaReprogramada,
      pacienteId: ids.paciente,
      psicologoId: ids.psicologo,
      inicio: nuevoInicio,
      duracionMinutos: 50,
      modalidad: modalidad_cita.PRESENCIAL,
      cambioHorario: true,
    });

    const recordatorios = await prisma.notificaciones.findMany({
      where: { cita_id: ids.citaReprogramada, tipo: tipo_notificacion.RECORDATORIO },
    });

    expect(recordatorios.length).toBeGreaterThan(0);
    expect(recordatorios.every((fila) => fila.estado !== estado_envio.CANCELADA)).toBe(true);
    expect(recordatorios.some((fila) => idsRecordatoriosViejos.includes(fila.id))).toBe(false);
    for (const fila of recordatorios) {
      expect(fila.programada_para).not.toBeNull();
      expect(fila.programada_para!.getTime()).toBeLessThan(nuevoInicio.getTime());
    }
  });

  it("limpia la cache vencida y conserva las filas vigentes", async () => {
    const vencida = await prisma.cache_registro.findUnique({ where: { clave: `${TAG}-vencida` } });
    const vigente = await prisma.cache_registro.findUnique({ where: { clave: `${TAG}-vigente` } });

    expect(vencida).toBeNull();
    expect(vigente).not.toBeNull();
  });

  it("no toca expedientes, citas, pagos, consentimientos, bitácoras ni usuarios", async () => {
    expect(await prisma.expedientes_clinicos.findUnique({ where: { id: ids.expediente } })).not.toBeNull();
    expect(await prisma.citas.findUnique({ where: { id: ids.cita } })).not.toBeNull();
    expect(await prisma.pagos_honorarios.findUnique({ where: { id: ids.pago } })).not.toBeNull();
    expect(
      await prisma.consentimientos_informados.findUnique({ where: { id: ids.consentimiento } }),
    ).not.toBeNull();
    expect(await prisma.entradas_bitacora.findUnique({ where: { id: ids.bitacora } })).not.toBeNull();
    expect(await prisma.usuarios.findUnique({ where: { id: ids.pacienteUsuario } })).not.toBeNull();
    expect(await prisma.usuarios.findUnique({ where: { id: ids.psicologoUsuario } })).not.toBeNull();
  });

  it("expira las solicitudes pendientes antiguas cuya fecha ya pasó", async () => {
    const expirada = await prisma.solicitudes_cita.findUnique({
      where: { id: solicitudPendienteVieja },
    });
    const futura = await prisma.solicitudes_cita.findUnique({
      where: { id: solicitudPendienteFutura },
    });
    const reciente = await prisma.solicitudes_cita.findUnique({
      where: { id: solicitudPendienteReciente },
    });

    expect(expirada?.estado).toBe(estado_solicitud.CANCELADA);
    expect(expirada?.atendida_en).not.toBeNull();
    expect(futura?.estado).toBe(estado_solicitud.PENDIENTE);
    expect(reciente?.estado).toBe(estado_solicitud.PENDIENTE);
  });

  it("elimina solicitudes terminales sin cita y conserva las que tienen cita", async () => {
    expect(await prisma.solicitudes_cita.findUnique({ where: { id: solicitudTerminalSinCita } })).toBeNull();
    expect(
      await prisma.solicitudes_cita.findUnique({ where: { id: solicitudTerminalConCita } }),
    ).not.toBeNull();
    expect(
      await prisma.solicitudes_cita.findUnique({ where: { id: solicitudCanceladaReciente } }),
    ).not.toBeNull();
  });

  it("es idempotente: una segunda ejecución no encuentra trabajo", () => {
    expect(segunda.eliminadas.notificaciones).toBe(0);
    expect(segunda.eliminadas.solicitudes_cita).toBe(0);
    expect(segunda.eliminadas.cache_registro).toBe(0);
    expect(segunda.solicitudesExpiradas).toBe(0);
  });

  it("dos purgas solapadas no fallan ni borran dos veces el mismo dato", async () => {
    const lote = `${TAG}-solapada-`;
    const idsSolapados = Array.from({ length: 30 }, () => randomUUID());
    await prisma.notificaciones.createMany({
      data: idsSolapados.map((id) => ({
        id,
        usuario_id: ids.pacienteUsuario,
        tipo: tipo_notificacion.CONFIRMACION,
        canal: canal_notificacion.SISTEMA,
        asunto: `${lote}${id}`,
        mensaje: "Prueba de purgas solapadas",
        estado: estado_envio.ENVIADA,
        creado_en: diasAtras(200),
        enviada_en: diasAtras(200),
      })),
    });

    const [a, b] = await Promise.all([purgarDatosVencidos(), purgarDatosVencidos()]);

    // La suma incluye cualquier otro aviso vencido de la base; lo que importa es
    // que las dos ejecuciones conviven (sin bloqueos) y que cada fila sembrada
    // desaparece una sola vez.
    expect(a.eliminadas.notificaciones + b.eliminadas.notificaciones).toBeGreaterThanOrEqual(30);
    const restantes = await prisma.notificaciones.count({
      where: { id: { in: idsSolapados } },
    });
    expect(restantes).toBe(0);
  });

  it("trabaja por lotes: más filas que un lote se vacían en la misma ejecución", async () => {
    const lote = `${TAG}-lotes-`;
    const total = 1_005;
    await prisma.notificaciones.createMany({
      data: Array.from({ length: total }, () => ({
        id: randomUUID(),
        usuario_id: ids.pacienteUsuario,
        tipo: tipo_notificacion.CONFIRMACION,
        canal: canal_notificacion.SISTEMA,
        asunto: lote,
        mensaje: "Prueba de borrado por lotes",
        estado: estado_envio.FALLIDA,
        creado_en: diasAtras(300),
      })),
    });

    const resultado = await purgarDatosVencidos();

    expect(resultado.eliminadas.notificaciones).toBeGreaterThanOrEqual(total);
    expect(await prisma.notificaciones.count({ where: { asunto: lote } })).toBe(0);
  });
});
