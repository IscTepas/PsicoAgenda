/**
 * Flujo completo de notificaciones para el paciente dowot38888@en2ch.com y la
 * psicóloga demo. Genera todos los eventos que disparan notificaciones, despacha
 * los canales inmediatos y captura los wamid / estados de entrega de WhatsApp.
 *
 * Uso (desde apps/api):
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx npx tsx scripts/test-flujo-completo-notificaciones.ts
 */
import dotenv from "dotenv";
import { config } from "@/config";
import { prisma } from "@/lib/prisma";
import { despacharPendientes } from "@/services/notification.service";

// La clave publicable vive en apps/web/.env; la cargamos para pedir tokens.
dotenv.config({ path: new URL("../../web/.env", import.meta.url), quiet: true });

const API = "http://localhost:4000/api";
const SUPABASE_URL = config.supabaseUrl;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const PACIENTE_EMAIL = "dowot38888@en2ch.com";
const PACIENTE_PASSWORD = "Recover1234";
const PSICOLOGA_EMAIL = "psicologo.demo@example.com";
const PSICOLOGA_PASSWORD = "123456";

// Horarios de prueba, todos en el futuro y sin solaparse.
const H = {
  reqA: new Date("2026-11-25T10:00:00.000Z"),
  reqB: new Date("2026-11-25T11:00:00.000Z"),
  citaC: new Date("2026-11-25T12:00:00.000Z"),
  citaD: new Date("2026-11-25T13:00:00.000Z"),
  citaDMod: new Date("2026-11-25T13:30:00.000Z"),
  reqE: new Date("2026-11-25T14:00:00.000Z"),
};

interface Token {
  access_token: string;
  user: { id: string };
}

interface Resultado {
  paso: number;
  evento: string;
  accion: string;
  notificaciones: NotifRow[];
}

interface NotifRow {
  id: string;
  usuario: string;
  canal: string;
  tipo: string;
  asunto: string;
  estado: string;
  mensaje_externo_id?: string;
  estado_entrega?: string;
}

async function login(email: string, password: string): Promise<Token> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`Login falló para ${email}: ${r.status}`);
  return (await r.json()) as Token;
}

async function api(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(json)}`);
  return json;
}

async function enableWhatsApp(userId: string, enable: boolean) {
  await prisma.usuarios.update({ where: { id: userId }, data: { notificar_whatsapp: enable } });
}

function buildWebhookPayload(wamid: string, status: string, timestamp: number) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: config.whatsappPhoneId,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              statuses: [
                {
                  id: wamid,
                  status,
                  timestamp: String(timestamp),
                  recipient_id: "5213110000000",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function simulateWebhook(wamid: string) {
  const base = Math.floor(Date.now() / 1000);
  for (const status of ["delivered", "read"]) {
    const r = await fetch(`${API}/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildWebhookPayload(wamid, status, base + 1)),
    });
    if (!r.ok) console.warn(`Webhook ${status} para ${wamid} falló: ${r.status}`);
  }
}

async function notificacionesDesde(desde: Date): Promise<NotifRow[]> {
  const rows = await prisma.notificaciones.findMany({
    where: { creado_en: { gte: desde } },
    orderBy: { creado_en: "asc" },
    select: {
      id: true,
      usuario_id: true,
      canal: true,
      tipo: true,
      asunto: true,
      estado: true,
      mensaje_externo_id: true,
      estado_entrega: true,
    },
  });
  const usuarios = await prisma.usuarios.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.usuario_id))] } },
    select: { id: true, correo: true },
  });
  const correos = new Map(usuarios.map((u) => [u.id, u.correo]));
  return rows.map((r) => ({
    id: r.id,
    usuario: correos.get(r.usuario_id) ?? r.usuario_id,
    canal: r.canal,
    tipo: r.tipo,
    asunto: r.asunto,
    estado: r.estado,
    mensaje_externo_id: r.mensaje_externo_id ?? undefined,
    estado_entrega: r.estado_entrega ?? undefined,
  }));
}

async function main() {
  if (!SUPABASE_KEY) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const inicio = new Date();
  const resultados: Resultado[] = [];

  const paciente = await login(PACIENTE_EMAIL, PACIENTE_PASSWORD);
  const psicologa = await login(PSICOLOGA_EMAIL, PSICOLOGA_PASSWORD);

  const perfilPaciente = await prisma.pacientes.findUniqueOrThrow({
    where: { usuario_id: paciente.user.id },
    select: { id: true },
  });
  const pacienteId = perfilPaciente.id;

  await enableWhatsApp(paciente.user.id, true);
  await enableWhatsApp(psicologa.user.id, true);
  console.log("✅ WhatsApp habilitado para paciente y psicóloga");

  const guardar = async (paso: number, evento: string, accion: string) => {
    // Varios eventos seguidos pueden dejar pendientes; barrer hasta vaciar lo inmediato.
    for (let i = 0; i < 5; i++) {
      const n = await despacharPendientes();
      if (n === 0) break;
    }
    const notifs = await notificacionesDesde(inicio);
    resultados.push({ paso, evento, accion, notificaciones: notifs });
  };

  // 1. Paciente solicita cita -> psicóloga (SOLICITUD_CREADA)
  const reqA = (await api(paciente.access_token, "POST", "/appointment-requests", {
    startTime: H.reqA.toISOString(),
    durationMinutes: 50,
    modality: "in_person",
    reason: "Solicitud A (será rechazada)",
  })) as { id: string };
  await guardar(1, "SOLICITUD_CREADA", `Paciente crea solicitud ${reqA.id}`);

  // 2. Psicóloga rechaza -> paciente (SOLICITUD_RECHAZADA)
  await api(psicologa.access_token, "POST", `/appointment-requests/${reqA.id}/reject`);
  await guardar(2, "SOLICITUD_RECHAZADA", `Psicóloga rechaza solicitud ${reqA.id}`);

  // 3. Paciente solicita cita -> psicóloga (SOLICITUD_CREADA)
  const reqB = (await api(paciente.access_token, "POST", "/appointment-requests", {
    startTime: H.reqB.toISOString(),
    durationMinutes: 50,
    modality: "in_person",
    reason: "Solicitud B (será aceptada)",
  })) as { id: string };
  await guardar(3, "SOLICITUD_CREADA", `Paciente crea solicitud ${reqB.id}`);

  // 4. Psicóloga acepta -> paciente (SOLICITUD_ACEPTADA + recordatorios)
  const citaB = (await api(psicologa.access_token, "POST", `/appointment-requests/${reqB.id}/accept`)) as {
    id: string;
  };
  await guardar(4, "SOLICITUD_ACEPTADA", `Psicóloga acepta solicitud ${reqB.id} -> cita ${citaB.id}`);

  // 5. Psicóloga agenda cita directa -> paciente (CITA_AGENDADA + recordatorios)
  const citaC = (await api(psicologa.access_token, "POST", "/appointments", {
    patientId: pacienteId,
    startTime: H.citaC.toISOString(),
    durationMinutes: 50,
    modality: "in_person",
    reason: "Cita C agendada por psicóloga",
  })) as { id: string };
  await guardar(5, "CITA_AGENDADA", `Psicóloga agenda cita ${citaC.id}`);

  // 6. Paciente crea cita directa -> psicóloga (CITA_SOLICITADA)
  const citaD = (await api(paciente.access_token, "POST", "/appointments", {
    patientId: pacienteId,
    startTime: H.citaD.toISOString(),
    durationMinutes: 50,
    modality: "in_person",
    reason: "Cita D solicitada por paciente",
  })) as { id: string };
  await guardar(6, "CITA_SOLICITADA", `Paciente crea cita ${citaD.id}`);

  // 7. Psicóloga confirma cita -> paciente (CITA_CONFIRMADA + recordatorios)
  await api(psicologa.access_token, "PATCH", `/appointments/${citaD.id}/status`, { status: "confirmed" });
  await guardar(7, "CITA_CONFIRMADA", `Psicóloga confirma cita ${citaD.id}`);

  // 8. Psicóloga modifica horario -> paciente (CITA_MODIFICADA)
  await api(psicologa.access_token, "PATCH", `/appointments/${citaD.id}`, {
    startTime: H.citaDMod.toISOString(),
    durationMinutes: 50,
    modality: "virtual",
    reason: "Cita D movida",
  });
  await guardar(8, "CITA_MODIFICADA", `Psicóloga modifica cita ${citaD.id}`);

  // 9. Psicóloga cancela cita -> paciente (CITA_CANCELADA_POR_PSICOLOGO)
  await api(psicologa.access_token, "POST", `/appointments/${citaD.id}/cancel`, { reason: "Cancelada por psicóloga" });
  await guardar(9, "CITA_CANCELADA_POR_PSICOLOGO", `Psicóloga cancela cita ${citaD.id}`);

  // 10. Paciente cancela cita -> psicóloga (CITA_CANCELADA_POR_PACIENTE)
  await api(paciente.access_token, "POST", `/appointments/${citaC.id}/cancel`, { reason: "Cancelada por paciente" });
  await guardar(10, "CITA_CANCELADA_POR_PACIENTE", `Paciente cancela cita ${citaC.id}`);

  // 11. Psicóloga marca asistencia -> paciente (CITA_ASISTENCIA)
  await api(psicologa.access_token, "PATCH", `/appointments/${citaB.id}/status`, { status: "completed" });
  await guardar(11, "CITA_ASISTENCIA", `Psicóloga marca asistencia en cita ${citaB.id}`);

  // 12. Paciente crea y cancela solicitud -> psicóloga (SOLICITUD_CANCELADA)
  const reqE = (await api(paciente.access_token, "POST", "/appointment-requests", {
    startTime: H.reqE.toISOString(),
    durationMinutes: 50,
    modality: "in_person",
    reason: "Solicitud E (será cancelada por paciente)",
  })) as { id: string };
  await api(paciente.access_token, "POST", `/appointment-requests/${reqE.id}/cancel`);
  await guardar(12, "SOLICITUD_CANCELADA", `Paciente cancela solicitud ${reqE.id}`);

  // Simular webhooks de entrega para todos los mensajes de WhatsApp enviados.
  const whatsappEnviados = resultados
    .flatMap((r) => r.notificaciones)
    .filter((n) => n.canal === "WHATSAPP" && n.mensaje_externo_id && n.estado === "ENVIADA");
  const unicos = [...new Map(whatsappEnviados.map((n) => [n.mensaje_externo_id, n])).values()];
  for (const n of unicos) {
    await simulateWebhook(n.mensaje_externo_id!);
  }

  // Estado final
  for (let i = 0; i < 5; i++) {
    const n = await despacharPendientes();
    if (n === 0) break;
  }

  await enableWhatsApp(paciente.user.id, false);
  await enableWhatsApp(psicologa.user.id, false);
  console.log("✅ Preferencias de WhatsApp restauradas");

  // Reporte
  console.log("\n=== RESUMEN DE EVENTOS ===\n");
  for (const r of resultados) {
    console.log(`Paso ${r.paso}: ${r.evento} — ${r.accion}`);
    for (const n of r.notificaciones) {
      const extra = n.canal === "WHATSAPP" ? ` | wamid=${n.mensaje_externo_id ?? "-"} delivery=${n.estado_entrega ?? "-"}` : "";
      console.log(`   [${n.canal}] ${n.tipo} -> ${n.usuario} | ${n.estado}${extra}`);
    }
  }

  console.log("\n=== WHATSAPP: MENSAJES Y ESTADOS ===\n");
  const final = await notificacionesDesde(inicio);
  for (const n of final.filter((x) => x.canal === "WHATSAPP")) {
    console.log(
      `${n.id} | ${n.tipo} | ${n.usuario} | ${n.estado} | wamid=${n.mensaje_externo_id ?? "-"} | delivery=${n.estado_entrega ?? "-"}`,
    );
  }

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error);
  void prisma.$disconnect();
  process.exit(1);
});
