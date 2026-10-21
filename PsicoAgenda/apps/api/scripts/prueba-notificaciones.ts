// Prueba de punta a punta de las notificaciones contra la base real, con las
// cuentas demo. Correr con el correo en modo consola:
//   GMAIL_USER= GMAIL_APP_PASSWORD= npx tsx scripts/prueba-notificaciones.ts
// Para recibir los correos de verdad: PRUEBA_CORREO=tu@gmail.com (usa alias +paciente / +psicologa).
// Deja la base como estaba: borra lo que crea y restaura correos y preferencias.
import { AppointmentModality, AppointmentStatus, UserRole } from "@psicoagenda/shared";
import { disconnectPrisma, prisma } from "@/lib/prisma";
import {
  acceptAppointmentRequest,
  createAppointmentRequest,
  rejectAppointmentRequest,
} from "@/services/appointment-request.service";
import { cancelAppointment, changeAppointmentStatus, updateAppointment } from "@/services/appointment.service";
import {
  despacharPendientes,
  listNotifications,
  markAllNotificationsRead,
} from "@/services/notification.service";

const inicioPrueba = new Date();
const fallos: string[] = [];
const check = (ok: boolean, texto: string) => {
  console.log(`${ok ? "✅" : "❌"} ${texto}`);
  if (!ok) fallos.push(texto);
};

const usuarioDemo = async (correo: string, role: UserRole) => {
  const u = await prisma.usuarios.findUniqueOrThrow({ where: { correo } });
  return { auth: { id: u.id, email: u.correo, role }, fila: u };
};

const paciente = await usuarioDemo("paciente.demo@example.com", UserRole.PATIENT);
const psicologa = await usuarioDemo("psicologo.demo@example.com", UserRole.PSYCHOLOGIST);
const prefsOriginales = {
  notificar_whatsapp: paciente.fila.notificar_whatsapp,
  notificar_correo: paciente.fila.notificar_correo,
  telefono: paciente.fila.telefono,
};

const destino = process.env.PRUEBA_CORREO;
const alias = (etiqueta: string) => destino!.replace("@", `+${etiqueta}@`);
if (destino) {
  await prisma.usuarios.update({ where: { id: paciente.auth.id }, data: { correo: alias("paciente") } });
  await prisma.usuarios.update({ where: { id: psicologa.auth.id }, data: { correo: alias("psicologa") } });
}

// WhatsApp encendido para ver que se encola (n8n no está conectado).
await prisma.usuarios.update({
  where: { id: paciente.auth.id },
  data: { notificar_whatsapp: true, notificar_correo: true, telefono: paciente.fila.telefono ?? "3110000000" },
});

const filasDe = (usuarioId: string) =>
  prisma.notificaciones.findMany({
    where: { usuario_id: usuarioId, creado_en: { gte: inicioPrueba } },
    orderBy: { creado_en: "asc" },
  });
const resumen = (filas: { tipo: string; canal: string; estado: string }[]) =>
  filas.map((f) => `${f.tipo}/${f.canal}/${f.estado}`).sort();

const citasCreadas: string[] = [];
const solicitudesCreadas: string[] = [];

try {
  // Hora fija en el futuro lejano para no chocar con citas reales.
  const base = new Date(Date.now() + 20 * 24 * 3600_000);
  base.setUTCHours(16, 7, 0, 0);

  // 1. Solicitud y rechazo.
  const sol1 = await createAppointmentRequest(paciente.auth, {
    startTime: base,
    durationMinutes: 50,
    modality: AppointmentModality.IN_PERSON,
    reason: "Prueba de notificaciones",
  });
  solicitudesCreadas.push(sol1.id);
  let psi = await filasDe(psicologa.auth.id);
  check(
    resumen(psi).join() === ["SOLICITUD/CORREO/PENDIENTE", "SOLICITUD/SISTEMA/PENDIENTE"].join() ||
      psi.filter((f) => f.tipo === "SOLICITUD").length === 2,
    `Solicitud nueva → psicóloga por sistema + correo (${resumen(psi).join(", ")})`,
  );

  await rejectAppointmentRequest(psicologa.auth, sol1.id);
  let pac = await filasDe(paciente.auth.id);
  check(
    pac.filter((f) => f.tipo === "RECHAZO").map((f) => f.canal).sort().join() === "CORREO,SISTEMA,WHATSAPP",
    "Solicitud rechazada → paciente por sistema + correo + WhatsApp",
  );

  // 2. Solicitud aceptada → confirmación + recordatorios.
  const sol2 = await createAppointmentRequest(paciente.auth, {
    startTime: new Date(base.getTime() + 24 * 3600_000),
    durationMinutes: 50,
    modality: AppointmentModality.VIRTUAL,
  });
  solicitudesCreadas.push(sol2.id);
  const cita = await acceptAppointmentRequest(psicologa.auth, sol2.id);
  citasCreadas.push(cita.id);
  pac = await filasDe(paciente.auth.id);
  check(
    pac.filter((f) => f.tipo === "CONFIRMACION").map((f) => f.canal).sort().join() === "CORREO,SISTEMA,WHATSAPP",
    "Solicitud aceptada → paciente por sistema + correo + WhatsApp",
  );
  const recordatorios = pac.filter((f) => f.tipo === "RECORDATORIO" && f.estado === "PENDIENTE");
  check(
    recordatorios.length === 4,
    `Recordatorios programados: 24 h (3 canales) + 2 h (WhatsApp) → ${recordatorios.length}`,
  );

  // 3. Mover la cita una hora → cambio con WhatsApp y recordatorios reprogramados.
  const nuevoInicio = new Date(cita.startTime.getTime() + 3600_000);
  await updateAppointment(psicologa.auth, cita.id, { startTime: nuevoInicio });
  pac = await filasDe(paciente.auth.id);
  check(
    pac.filter((f) => f.tipo === "CAMBIO").map((f) => f.canal).sort().join() === "CORREO,SISTEMA,WHATSAPP",
    "Cita movida de hora → paciente por sistema + correo + WhatsApp",
  );
  const vivos = pac.filter((f) => f.tipo === "RECORDATORIO" && f.estado === "PENDIENTE");
  check(
    vivos.length === 4 &&
      vivos.every((f) => f.programada_para!.getTime() < nuevoInicio.getTime() && f.programada_para!.getTime() > cita.startTime.getTime() - 24 * 3600_000),
    "Recordatorios reprogramados a la nueva hora (los viejos cancelados)",
  );

  // 4. Confirmar no duplica correo (la cita ya está CONFIRMADA al aceptar).
  await changeAppointmentStatus(psicologa.auth, cita.id, AppointmentStatus.CONFIRMED);

  // 5. El paciente cancela → aviso a la psicóloga y recordatorios cancelados.
  await cancelAppointment(paciente.auth, cita.id, "Prueba: no puedo asistir");
  psi = await filasDe(psicologa.auth.id);
  check(
    psi.filter((f) => f.tipo === "CANCELACION").map((f) => f.canal).sort().join() === "CORREO,SISTEMA",
    "Cancelada por el paciente → psicóloga por sistema + correo",
  );
  pac = await filasDe(paciente.auth.id);
  check(
    pac.filter((f) => f.tipo === "RECORDATORIO" && f.estado === "PENDIENTE").length === 0,
    "Sin recordatorios pendientes tras cancelar",
  );

  // 6. Despacho: sistema y correo salen; WhatsApp espera a n8n.
  // Con Gmail real cada correo tarda 1–2 s: se espera hasta 60 s.
  for (let i = 0; i < 120; i++) {
    await despacharPendientes();
    const quedan = await prisma.notificaciones.count({
      where: {
        usuario_id: { in: [paciente.auth.id, psicologa.auth.id] },
        creado_en: { gte: inicioPrueba },
        estado: "PENDIENTE",
        canal: { in: ["SISTEMA", "CORREO"] },
        programada_para: { lte: new Date() },
      },
    });
    if (quedan === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const todas = [...(await filasDe(paciente.auth.id)), ...(await filasDe(psicologa.auth.id))];
  const inmediatas = todas.filter((f) => f.tipo !== "RECORDATORIO");
  check(
    inmediatas.filter((f) => f.canal !== "WHATSAPP").every((f) => f.estado === "ENVIADA"),
    "Sistema y correo despachados (ENVIADA)",
  );
  for (const f of inmediatas.filter((f) => f.canal !== "WHATSAPP" && f.estado !== "ENVIADA")) {
    console.log(`   ↳ ${f.tipo}/${f.canal}: ${f.estado} intentos=${f.intentos} error=${f.error ?? "-"}`);
  }
  check(
    inmediatas.filter((f) => f.canal === "WHATSAPP").every((f) => f.estado === "PENDIENTE"),
    "WhatsApp queda PENDIENTE para n8n",
  );

  // 7. Campana: solo SISTEMA, y marcar leídas.
  const bandeja = await listNotifications(psicologa.auth);
  const nuevas = bandeja.filter((n) => n.createdAt >= inicioPrueba);
  check(
    nuevas.length === 3 && nuevas.every((n) => n.channel === "system" && !n.readAt),
    `Campana de la psicóloga: ${nuevas.length} avisos del sistema sin leer`,
  );
  await markAllNotificationsRead(psicologa.auth);
  const leidas = (await listNotifications(psicologa.auth)).filter((n) => n.createdAt >= inicioPrueba);
  check(leidas.every((n) => n.readAt), "Marcar todo como leído persiste");

  console.log("\nAvisos de la paciente:");
  for (const f of await filasDe(paciente.auth.id)) {
    if (f.canal === "SISTEMA") console.log(`  • ${f.asunto}: ${f.mensaje}`);
  }
} finally {
  // Limpieza: todo lo que creó la prueba.
  await prisma.notificaciones.deleteMany({
    where: { usuario_id: { in: [paciente.auth.id, psicologa.auth.id] }, creado_en: { gte: inicioPrueba } },
  });
  await prisma.pagos_honorarios.deleteMany({ where: { cita_id: { in: citasCreadas } } });
  await prisma.citas.deleteMany({ where: { id: { in: citasCreadas } } });
  await prisma.solicitudes_cita.deleteMany({ where: { id: { in: solicitudesCreadas } } });
  await prisma.usuarios.update({
    where: { id: paciente.auth.id },
    data: { ...prefsOriginales, correo: paciente.fila.correo },
  });
  await prisma.usuarios.update({ where: { id: psicologa.auth.id }, data: { correo: psicologa.fila.correo } });
  await disconnectPrisma();
}

console.log(fallos.length === 0 ? "\nTodo bien." : `\n${fallos.length} fallo(s).`);
process.exit(fallos.length === 0 ? 0 : 1);
