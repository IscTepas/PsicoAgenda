import {
  UserRole,
  type EmergencyContact,
  type Patient,
  type PatientProfile,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";
import { guardianshipEndedAt, linkSelect, toGuardian } from "@/services/guardianship.service";

const patientListInclude = {
  usuarios: true,
} as Prisma.pacientesInclude;

const patientInclude = {
  usuarios: true,
  pacientes_tutores: { select: linkSelect, orderBy: [{ es_principal: "desc" }, { creado_en: "asc" }] },
  // Relación to-one: cada paciente tiene una sola ficha de contacto de emergencia.
  contactos_emergencia: true,
} satisfies Prisma.pacientesInclude;

type PatientRow = Prisma.pacientesGetPayload<{ include: typeof patientInclude }>;
type PatientListRow = Prisma.pacientesGetPayload<{ include: typeof patientListInclude }>;
type EmergencyContactRow = NonNullable<PatientRow["contactos_emergencia"]>;

/**
 * Un paciente es menor de edad mientras no haya cumplido los 18 años. La fecha
 * llega como `DATE` sin zona horaria, así que el cálculo es por calendario y no
 * por instante.
 */
function computeIsMinor(birthDate: Date | null): boolean {
  if (!birthDate) return false;
  const eighteenthBirthday = new Date(birthDate);
  eighteenthBirthday.setFullYear(birthDate.getFullYear() + 18);
  return eighteenthBirthday > new Date();
}

function toEmergencyContact(row: EmergencyContactRow): EmergencyContact {
  return {
    id: row.id,
    patientId: row.paciente_id,
    name: row.nombre_completo,
    phone: row.telefono,
    relationship: row.parentesco ?? undefined,
    isPrimary: row.es_principal,
    createdAt: row.creado_en,
  };
}

function toPatient(row: PatientRow): Patient {
  // Relación to-one: `contactos_emergencia` es un objeto o `null`.
  const primaryContact = row.contactos_emergencia;
  // Los vínculos de un adulto ya no valen (el barrido los borra a diario).
  const guardians = computeIsMinor(row.fecha_nacimiento) ? row.pacientes_tutores.map(toGuardian) : [];

  return {
    id: row.id,
    email: row.usuarios.correo,
    name: row.usuarios.nombre_completo,
    phone: row.usuarios.telefono ?? undefined,
    role: UserRole.PATIENT,
    birthDate: row.fecha_nacimiento ?? undefined,
    gender: row.sexo ?? undefined,
    address: row.direccion ?? undefined,
    isMinor: computeIsMinor(row.fecha_nacimiento),
    psychologistId: row.psicologo_id ?? undefined,
    emergencyContact: primaryContact ? toEmergencyContact(primaryContact) : undefined,
    legalGuardian: guardians.find((g) => g.isPrimary),
    guardians,
    createdAt: row.usuarios.creado_en,
    updatedAt: row.usuarios.actualizado_en,
  };
}

function toPatientProfile(row: PatientRow): PatientProfile {
  const { usuarios: user } = row;

  return {
    ...toPatient(row),
    timeZone: user.zona_horaria,
    photoUrl: user.foto_perfil_url ?? undefined,
    notifyWhatsapp: user.notificar_whatsapp,
    notifyEmail: user.notificar_correo,
  };
}

/** Perfil del paciente autenticado (incluye preferencias de la cuenta). */
export async function getMyPatientProfile(auth: AuthenticatedUser): Promise<PatientProfile> {
  const row = await prisma.pacientes.findUnique({
    where: { usuario_id: auth.id },
    include: patientInclude,
  });

  if (!row) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }

  return { ...toPatientProfile(row), guardianshipEndedAt: await guardianshipEndedAt(row.id) };
}

export interface UpdatePatientProfileInput {
  name?: string;
  phone?: string;
  timeZone?: string;
  photoUrl?: string;
  notifyWhatsapp?: boolean;
  notifyEmail?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

const emptyToNull = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : value.trim() === "" ? null : value;

export async function updateMyPatientProfile(
  auth: AuthenticatedUser,
  input: UpdatePatientProfileInput,
): Promise<PatientProfile> {
  const existing = await prisma.pacientes.findUnique({
    where: { usuario_id: auth.id },
    select: { id: true },
  });

  if (!existing) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const userData: Prisma.usuariosUpdateInput = {};
    if (input.name !== undefined) userData.nombre_completo = input.name;
    if (input.phone !== undefined) userData.telefono = emptyToNull(input.phone);
    if (input.timeZone !== undefined) userData.zona_horaria = input.timeZone;
    if (input.photoUrl !== undefined) userData.foto_perfil_url = emptyToNull(input.photoUrl);
    if (input.notifyWhatsapp !== undefined) userData.notificar_whatsapp = input.notifyWhatsapp;
    if (input.notifyEmail !== undefined) userData.notificar_correo = input.notifyEmail;

    if (Object.keys(userData).length > 0) {
      await tx.usuarios.update({ where: { id: auth.id }, data: userData });
    }

    // El contacto de emergencia se edita como un bloque: el formulario solo maneja
    // el principal. Si no existe todavía, se crea.
    const touchesContact =
      input.emergencyContactName !== undefined ||
      input.emergencyContactPhone !== undefined ||
      input.emergencyContactRelationship !== undefined;

    if (touchesContact) {
      const primary = await tx.contactos_emergencia.findFirst({
        where: { paciente_id: existing.id, es_principal: true },
        select: { id: true },
      });

      if (primary) {
        await tx.contactos_emergencia.update({
          where: { id: primary.id },
          data: {
            // `undefined` deja el valor actual; una cadena vacía no debe pisar
            // columnas NOT NULL con "".
            nombre_completo: input.emergencyContactName?.trim() || undefined,
            telefono: input.emergencyContactPhone?.trim() || undefined,
            parentesco: emptyToNull(input.emergencyContactRelationship),
          },
        });
      } else {
        // Sin contacto previo el bloque necesita nombre y teléfono: ambos son
        // NOT NULL. Antes se omitía en silencio y la API respondía 200.
        const nombre = input.emergencyContactName?.trim();
        const telefono = input.emergencyContactPhone?.trim();
        if (!nombre || !telefono) {
          throw new AppError(
            400,
            "Para guardar el contacto de emergencia se necesitan el nombre y el teléfono.",
            "CONTACTO_INCOMPLETO",
          );
        }

        await tx.contactos_emergencia.create({
          data: {
            id: randomUUID(),
            paciente_id: existing.id,
            nombre_completo: nombre,
            telefono,
            parentesco: input.emergencyContactRelationship?.trim() || null,
            es_principal: true,
          },
        });
      }
    }

    return tx.pacientes.findUniqueOrThrow({ where: { id: existing.id }, include: patientInclude });
  });

  return toPatientProfile(updated);
}

/**
 * Lista de pacientes. Un paciente solo puede verse a sí mismo; el psicólogo y el
 * administrador ven el directorio completo de cuentas activas.
 */
export interface ListPatientsFilter {
  limit?: number;
  offset?: number;
  page?: number;
}

export async function listPatients(auth: AuthenticatedUser, filter: ListPatientsFilter = {}): Promise<Patient[]> {
  const where: Prisma.pacientesWhereInput = { usuarios: { activo: true } };

  if (auth.role === UserRole.PATIENT) {
    where.usuario_id = auth.id;
  }

  const limit = filter.limit ?? 100;
  const offset =
    filter.offset ?? (filter.page && filter.page >= 1 ? (filter.page - 1) * limit : 0);

  const rows = await prisma.pacientes.findMany({
    where,
    include: patientListInclude,
    orderBy: { usuarios: { nombre_completo: "asc" } },
    take: limit,
    skip: offset,
  });

  return rows.map((row: PatientListRow): Patient => {
    return {
      id: row.id,
      email: row.usuarios.correo,
      name: row.usuarios.nombre_completo,
      phone: row.usuarios.telefono ?? undefined,
      role: UserRole.PATIENT,
      birthDate: row.fecha_nacimiento ?? undefined,
      gender: row.sexo ?? undefined,
      address: row.direccion ?? undefined,
      isMinor: computeIsMinor(row.fecha_nacimiento),
      psychologistId: row.psicologo_id ?? undefined,
      emergencyContact: undefined,
      legalGuardian: undefined,
      createdAt: row.usuarios.creado_en,
      updatedAt: row.usuarios.actualizado_en,
    };
  });
}

export async function getPatientById(id: string, auth: AuthenticatedUser): Promise<Patient> {
  const row = await prisma.pacientes.findUnique({ where: { id }, include: patientInclude });

  if (!row) {
    throw AppError.notFound("El paciente no existe");
  }

  if (auth.role === UserRole.PATIENT && row.usuario_id !== auth.id) {
    throw AppError.forbidden("No puedes consultar el expediente de otro paciente");
  }

  return toPatient(row);
}
