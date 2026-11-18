// Prueba de concurrencia contra la base real, con las cuentas demo: lanza la misma
// operación varias veces a la vez y cuenta cuántas ganan. Correr con el correo en
// modo consola y un pool que permita solaparse:
//   GMAIL_USER= GMAIL_APP_PASSWORD= DATABASE_POOL_MAX=4 npx tsx scripts/prueba-concurrencia.ts
// Deja la base como estaba: borra todo lo que crea.
import { AppointmentModality, UserRole } from "@psicoagenda/shared";
import { disconnectPrisma, prisma } from "@/lib/prisma";
import { acceptAppointmentRequest, createAppointmentRequest } from "@/services/appointment-request.service";
import { cancelAppointment, createAppointment } from "@/services/appointment.service";

const VECES = 6;
const inicioPrueba = new Date();
const fallos: string[] = [];
const check = (ok: boolean, texto: string) => {
  console.log(`${ok ? "✅" : "❌"} ${texto}`);
  if (!ok) fallos.push(texto);
};

const usuarioDemo = async (correo: string, role: UserRole) => {
  const u = await prisma.usuarios.findUniqueOrThrow({ where: { correo } });
  return { id: u.id, email: u.correo, role };
};

const paciente = await usuarioDemo("paciente.demo@example.com", UserRole.PATIENT);
const psicologa = await usuarioDemo("psicologo.demo@example.com", UserRole.PSYCHOLOGIST);
const pacienteFila = await prisma.pacientes.findUniqueOrThrow({ where: { usuario_id: paciente.id } });

/** Lanza `n` veces la misma operación a la vez y separa las que ganaron de las que no. */
async function aLaVez<T>(n: number, operacion: () => Promise<T>) {
  const ok: T[] = [];
  const errores: (number | string)[] = [];
  await Promise.all(
    Array.from({ length: n }, () =>
      operacion().then(
        (valor) => void ok.push(valor),
        (error: unknown) => {
          const { statusCode, message } = error as { statusCode?: number; message?: string };
          errores.push(statusCode ?? String(message).slice(0, 80));
        },
      ),
    ),
  );
  return { ok, errores };
}

// Horas fijas en un futuro lejano, en martes a las 16:00 UTC (10:00 en México), para no chocar con nada real.
const base = new Date(Date.now() + 40 * 24 * 3600_000);
base.setUTCDate(base.getUTCDate() + ((2 - base.getUTCDay() + 7) % 7));
base.setUTCHours(16, 0, 0, 0);
const dia = (n: number) => new Date(base.getTime() + n * 7 * 24 * 3600_000);

try {
  // 1. La psicóloga agenda el mismo horario varias veces a la vez.
  const citas = await aLaVez(VECES, () =>
    createAppointment(psicologa, {
      patientId: pacienteFila.id,
      startTime: dia(0),
      durationMinutes: 50,
      modality: AppointmentModality.IN_PERSON,
    }),
  );
  check(
    citas.ok.length === 1 && citas.errores.every((e) => e === 409),
    `Misma cita ${VECES} veces a la vez → ${citas.ok.length} creada, el resto ${JSON.stringify([...new Set(citas.errores)])}`,
  );

  // 2. El paciente manda la misma solicitud varias veces a la vez (doble clic, dos pestañas).
  const solicitudes = await aLaVez(VECES, () =>
    createAppointmentRequest(paciente, {
      startTime: dia(1),
      durationMinutes: 50,
      modality: AppointmentModality.IN_PERSON,
    }),
  );
  check(
    solicitudes.ok.length === 1 && solicitudes.errores.every((e) => e === 409),
    `Misma solicitud ${VECES} veces a la vez → ${solicitudes.ok.length} creada(s), el resto ${JSON.stringify([...new Set(solicitudes.errores)])}`,
  );

  // 3. La psicóloga acepta la misma solicitud varias veces a la vez.
  const paraAceptar = solicitudes.ok[0]!;
  const aceptadas = await aLaVez(VECES, () => acceptAppointmentRequest(psicologa, paraAceptar.id));
  const citasDeLaSolicitud = await prisma.citas.count({ where: { solicitud_id: paraAceptar.id } });
  check(
    aceptadas.ok.length === 1 && citasDeLaSolicitud === 1,
    `Aceptar la misma solicitud ${VECES} veces a la vez → ${citasDeLaSolicitud} cita, ${aceptadas.ok.length} respuesta(s) OK`,
  );

  // 4. Cancelar la misma cita varias veces a la vez: una sola cancelación y un solo aviso.
  const citaACancelar = citas.ok[0]!;
  const canceladas = await aLaVez(VECES, () => cancelAppointment(psicologa, citaACancelar.id, "Prueba de concurrencia"));
  // Margen para que terminen de escribirse los avisos.
  await new Promise((r) => setTimeout(r, 1500));
  const avisos = await prisma.notificaciones.count({
    where: { cita_id: citaACancelar.id, tipo: "CANCELACION", canal: "SISTEMA", creado_en: { gte: inicioPrueba } },
  });
  check(
    canceladas.ok.length === 1 && avisos === 1,
    `Cancelar la misma cita ${VECES} veces a la vez → ${canceladas.ok.length} OK, ${avisos} aviso(s) de cancelación`,
  );
} finally {
  // Limpieza: todo lo que creó la prueba.
  await new Promise((r) => setTimeout(r, 1500));
  const citasDePrueba = await prisma.citas.findMany({
    where: { paciente_id: pacienteFila.id, creado_en: { gte: inicioPrueba } },
    select: { id: true },
  });
  const ids = citasDePrueba.map((c) => c.id);
  await prisma.notificaciones.deleteMany({
    where: { usuario_id: { in: [paciente.id, psicologa.id] }, creado_en: { gte: inicioPrueba } },
  });
  await prisma.pagos_honorarios.deleteMany({ where: { cita_id: { in: ids } } });
  await prisma.citas.deleteMany({ where: { id: { in: ids } } });
  await prisma.solicitudes_cita.deleteMany({ where: { paciente_id: pacienteFila.id, creado_en: { gte: inicioPrueba } } });
  await disconnectPrisma();
}

console.log(fallos.length === 0 ? "\nTodo bien." : `\n${fallos.length} fallo(s).`);
process.exit(fallos.length === 0 ? 0 : 1);
