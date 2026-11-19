import { createHash, randomBytes, randomUUID } from "node:crypto";
import { APP_NAME } from "@psicoagenda/shared";
import { config } from "@/config";
import { prisma } from "@/lib/prisma";
import { cacheRegistro } from "@/services/codigo-cache.repo";
import { enviarCorreoNotificacion } from "@/services/mailer.service";
import { requirePsychologistIdByUser } from "@/services/psychologist.service";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

/**
 * Cita única: la psicóloga da de alta a alguien sin que pase por el registro.
 * Como los menores que registra un tutor, el paciente no tiene cuenta: su fila de
 * `usuarios` lleva un correo reservado (`.invalid` nunca se entrega). Si después
 * quiere seguir en terapia, se le invita a registrarse y su cuenta se queda con
 * todo lo de la cita única.
 */

export interface CitaUnicaInput {
  name: string;
  phone?: string;
  email?: string;
  isMinor: boolean;
  birthDate?: Date;
  guardian?: { name: string; phone: string; relationship?: string };
}

const soloDigitos = (telefono: string) => telefono.replace(/\D/g, "");

/** Teléfono ya usado por un paciente activo: evita duplicar a quien ya existe. */
async function pacienteConTelefono(telefono: string): Promise<{ id: string; nombre: string } | null> {
  const filas = await prisma.$queryRaw<{ id: string; nombre: string }[]>`
    SELECT p.id, u.nombre_completo AS nombre
      FROM pacientes p
      JOIN usuarios u ON u.id = p.usuario_id
     WHERE u.activo
       AND regexp_replace(coalesce(u.telefono, ''), '\\D', '', 'g') = ${soloDigitos(telefono)}
     LIMIT 1
  `;
  return filas[0] ?? null;
}

export async function crearPacienteCitaUnica(
  auth: AuthenticatedUser,
  input: CitaUnicaInput,
): Promise<{ id: string; name: string }> {
  const psicologoId = await requirePsychologistIdByUser(auth.id);
  const nombre = input.name.trim();
  const correo = input.email?.trim().toLowerCase() || null;
  // De un menor, el contacto (y los recordatorios por WhatsApp) es su tutor.
  const telefono = input.isMinor ? input.guardian!.phone : input.phone!;

  if (!input.isMinor) {
    const existente = await pacienteConTelefono(telefono);
    if (existente) {
      throw new AppError(409, `Este teléfono ya es de ${existente.nombre}.`, "PACIENTE_EXISTENTE", {
        patientId: existente.id,
        name: existente.nombre,
      });
    }
  }

  const usuarioId = randomUUID();
  const pacienteId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.create({
      data: {
        id: usuarioId,
        correo: `cita-unica-${usuarioId}@sin-cuenta.invalid`,
        correo_contacto: correo,
        nombre_completo: nombre,
        telefono,
        rol: "PACIENTE",
        notificar_correo: Boolean(correo),
        notificar_whatsapp: true,
      },
    });
    await tx.pacientes.create({
      data: {
        id: pacienteId,
        usuario_id: usuarioId,
        fecha_nacimiento: input.isMinor ? input.birthDate : null,
        psicologo_id: psicologoId,
        cita_unica: true,
      },
    });
    if (input.isMinor && input.guardian) {
      const tutorId = randomUUID();
      await tx.tutores.create({
        data: {
          id: tutorId,
          nombre_completo: input.guardian.name.trim(),
          telefono: input.guardian.phone,
          parentesco: input.guardian.relationship?.trim() || null,
        },
      });
      await tx.pacientes_tutores.create({
        data: { paciente_id: pacienteId, tutor_id: tutorId, es_principal: true },
      });
    }
  });

  return { id: pacienteId, name: nombre };
}

// ---------------------------------------------------------------------------
// Invitación a crear cuenta
// ---------------------------------------------------------------------------

export const INVITACION_TTL_SECONDS = 7 * 24 * 3600;

const sha256 = (valor: string) => createHash("sha256").update(valor).digest("hex");
const claveInvitacion = (token: string) => `invitacion:${sha256(token)}`;

async function pacienteCitaUnicaDe(pacienteId: string) {
  const paciente = await prisma.pacientes.findUnique({
    where: { id: pacienteId },
    select: {
      id: true,
      cita_unica: true,
      psicologo_id: true,
      fecha_nacimiento: true,
      usuarios: { select: { nombre_completo: true, telefono: true, correo_contacto: true } },
    },
  });
  if (!paciente) throw AppError.notFound("El paciente no existe");
  return paciente;
}

/** Genera el enlace de registro ligado a la ficha. Si hay correo de contacto, lo manda. */
export async function crearInvitacion(
  auth: AuthenticatedUser,
  pacienteId: string,
): Promise<{ enlace: string; expiraEn: Date; enviadoPorCorreo: boolean }> {
  const psicologoId = await requirePsychologistIdByUser(auth.id);
  const paciente = await pacienteCitaUnicaDe(pacienteId);
  if (paciente.psicologo_id !== psicologoId) {
    throw AppError.forbidden("No puedes invitar al paciente de otro profesional");
  }
  if (!paciente.cita_unica) {
    throw AppError.conflict("Este paciente ya tiene cuenta");
  }

  const token = randomBytes(32).toString("base64url");
  await cacheRegistro.set(claveInvitacion(token), paciente.id, INVITACION_TTL_SECONDS);
  const enlace = `${config.webUrl}/registro?invitacion=${token}`;

  let enviadoPorCorreo = false;
  const correo = paciente.usuarios.correo_contacto;
  if (correo) {
    try {
      await enviarCorreoNotificacion({
        to: correo,
        subject: `${APP_NAME}: crea tu cuenta para seguir con tus citas`,
        text: [
          `Hola, ${paciente.usuarios.nombre_completo}.`,
          "",
          `Para seguir agendando tus citas en ${APP_NAME}, crea tu cuenta con este enlace:`,
          enlace,
          "",
          "Tu historial con tu psicóloga se conserva. El enlace vale 7 días.",
        ].join("\n"),
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
            <h1 style="font-size: 20px; margin-bottom: 8px;">${APP_NAME}</h1>
            <p style="font-size: 15px;">Hola, ${paciente.usuarios.nombre_completo.replace(/</g, "&lt;")}.</p>
            <p style="font-size: 15px;">Para seguir agendando tus citas, crea tu cuenta. Tu historial con tu psicóloga se conserva.</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${enlace}" style="display: inline-block; background: #1f2937; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Crear mi cuenta</a>
            </p>
            <p style="font-size: 13px; color: #6b7280;">El enlace vale 7 días.</p>
          </div>
        `,
      });
      enviadoPorCorreo = true;
    } catch (error) {
      console.error("[cita-unica] No salió el correo de invitación:", error);
    }
  }

  return { enlace, expiraEn: new Date(Date.now() + INVITACION_TTL_SECONDS * 1000), enviadoPorCorreo };
}

/** Datos para prellenar el registro desde la invitación. No revela nada sin token válido. */
export async function leerInvitacion(token: string): Promise<{ name: string; phone?: string; email?: string }> {
  const pacienteId = await cacheRegistro.get(claveInvitacion(token));
  if (!pacienteId) throw new AppError(404, "Esta invitación ya no es válida. Pide una nueva a tu psicóloga.", "INVITACION_INVALIDA");
  const paciente = await pacienteCitaUnicaDe(pacienteId);
  if (!paciente.cita_unica) throw new AppError(404, "Esta invitación ya se usó.", "INVITACION_INVALIDA");
  return {
    name: paciente.usuarios.nombre_completo,
    phone: paciente.usuarios.telefono ?? undefined,
    email: paciente.usuarios.correo_contacto ?? undefined,
  };
}

/** Comprueba la invitación antes de crear la cuenta, para no dejar un alta a medias. */
export async function validarInvitacion(token: string): Promise<void> {
  await leerInvitacion(token);
}

/**
 * Al registrarse con la invitación, la cuenta nueva se queda con la ficha de la
 * cita única: citas, expediente, bitácora y cobros siguen colgando del mismo
 * paciente. El paciente vacío que el alta creó (con los datos del formulario) se
 * funde en él y desaparece, igual que la fila sin cuenta.
 */
export async function fusionarInvitacion(token: string, nuevoUsuarioId: string): Promise<void> {
  const clave = claveInvitacion(token);
  const pacienteId = await cacheRegistro.get(clave);
  if (!pacienteId) return;

  await prisma.$transaction(async (tx) => {
    const viejo = await tx.pacientes.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        usuario_id: true,
        cita_unica: true,
        contactos_emergencia: { select: { id: true } },
      },
    });
    if (!viejo?.cita_unica) return;

    // El alta (trigger `handle_new_user`) ya creó su propio paciente con los datos del formulario.
    const nuevo = await tx.pacientes.findUnique({
      where: { usuario_id: nuevoUsuarioId },
      select: {
        id: true,
        fecha_nacimiento: true,
        sexo: true,
        direccion: true,
        contactos_emergencia: { select: { id: true } },
        pacientes_tutores: { select: { tutor_id: true } },
      },
    });

    if (nuevo) {
      // Lo capturado en el registro es más completo: pasa a la ficha que se conserva.
      if (nuevo.contactos_emergencia) {
        if (viejo.contactos_emergencia) {
          await tx.contactos_emergencia.delete({ where: { id: viejo.contactos_emergencia.id } });
        }
        await tx.contactos_emergencia.update({
          where: { id: nuevo.contactos_emergencia.id },
          data: { paciente_id: viejo.id },
        });
      }
      if (nuevo.pacientes_tutores.length > 0) {
        await tx.pacientes_tutores.deleteMany({ where: { paciente_id: viejo.id } });
        await tx.pacientes_tutores.updateMany({ where: { paciente_id: nuevo.id }, data: { paciente_id: viejo.id } });
      }
      await tx.pacientes.delete({ where: { id: nuevo.id } });
      await tx.pacientes.update({
        where: { id: viejo.id },
        data: {
          usuario_id: nuevoUsuarioId,
          cita_unica: false,
          fecha_nacimiento: nuevo.fecha_nacimiento ?? undefined,
          sexo: nuevo.sexo ?? undefined,
          direccion: nuevo.direccion ?? undefined,
        },
      });
    } else {
      await tx.pacientes.update({ where: { id: viejo.id }, data: { usuario_id: nuevoUsuarioId, cita_unica: false } });
    }

    // Los avisos que ya recibió siguen siendo suyos; la fila sin cuenta se va.
    await tx.notificaciones.updateMany({ where: { usuario_id: viejo.usuario_id }, data: { usuario_id: nuevoUsuarioId } });
    await tx.usuarios.delete({ where: { id: viejo.usuario_id } });
  });

  await cacheRegistro.del(clave);
}
