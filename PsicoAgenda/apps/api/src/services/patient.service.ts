import {
  UserRole,
  type EmergencyContact,
  type LegalGuardian,
  type Patient,
  type PatientProfile,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

const patientInclude = {
  user: true,
  legalGuardian: true,
  // El contacto marcado como principal primero: la interfaz solo muestra uno.
  emergencyContacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
} satisfies Prisma.PatientInclude;

type PatientRow = Prisma.PatientGetPayload<{ include: typeof patientInclude }>;
type EmergencyContactRow = PatientRow["emergencyContacts"][number];
type LegalGuardianRow = NonNullable<PatientRow["legalGuardian"]>;

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
    patientId: row.patientId,
    name: row.name,
    phone: row.phone,
    relationship: row.relationship ?? undefined,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
  };
}

function toLegalGuardian(row: LegalGuardianRow): LegalGuardian {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    documentId: row.documentId ?? undefined,
    relationship: row.relationship ?? undefined,
    createdAt: row.createdAt,
  };
}

function toPatient(row: PatientRow): Patient {
  const primaryContact = row.emergencyContacts.find((contact) => contact.isPrimary);

  return {
    id: row.id,
    email: row.user.email,
    name: row.user.name,
    phone: row.user.phone ?? undefined,
    role: UserRole.PATIENT,
    birthDate: row.birthDate ?? undefined,
    gender: row.gender ?? undefined,
    address: row.address ?? undefined,
    isMinor: computeIsMinor(row.birthDate),
    psychologistId: row.psychologistId ?? undefined,
    emergencyContact: primaryContact ? toEmergencyContact(primaryContact) : undefined,
    legalGuardian: row.legalGuardian ? toLegalGuardian(row.legalGuardian) : undefined,
    createdAt: row.user.createdAt,
    updatedAt: row.user.updatedAt,
  };
}

function toPatientProfile(row: PatientRow): PatientProfile {
  const { user } = row;

  return {
    ...toPatient(row),
    timeZone: user.timeZone,
    photoUrl: user.photoUrl ?? undefined,
    notifyWhatsapp: user.notifyWhatsapp,
    notifyEmail: user.notifyEmail,
  };
}

/** Perfil del paciente autenticado (incluye preferencias de la cuenta). */
export async function getMyPatientProfile(auth: AuthenticatedUser): Promise<PatientProfile> {
  const row = await prisma.patient.findUnique({
    where: { userId: auth.id },
    include: patientInclude,
  });

  if (!row) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }

  return toPatientProfile(row);
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
  const existing = await prisma.patient.findUnique({
    where: { userId: auth.id },
    select: { id: true },
  });

  if (!existing) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const userData: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) userData.name = input.name;
    if (input.phone !== undefined) userData.phone = emptyToNull(input.phone);
    if (input.timeZone !== undefined) userData.timeZone = input.timeZone;
    if (input.photoUrl !== undefined) userData.photoUrl = emptyToNull(input.photoUrl);
    if (input.notifyWhatsapp !== undefined) userData.notifyWhatsapp = input.notifyWhatsapp;
    if (input.notifyEmail !== undefined) userData.notifyEmail = input.notifyEmail;

    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: auth.id }, data: userData });
    }

    // El contacto de emergencia se edita como un bloque: el formulario solo maneja
    // el principal. Si no existe todavía, se crea.
    const touchesContact =
      input.emergencyContactName !== undefined ||
      input.emergencyContactPhone !== undefined ||
      input.emergencyContactRelationship !== undefined;

    if (touchesContact) {
      const primary = await tx.emergencyContact.findFirst({
        where: { patientId: existing.id, isPrimary: true },
        select: { id: true },
      });

      if (primary) {
        await tx.emergencyContact.update({
          where: { id: primary.id },
          data: {
            name: input.emergencyContactName,
            phone: input.emergencyContactPhone,
            relationship: input.emergencyContactRelationship,
          },
        });
      } else if (input.emergencyContactName && input.emergencyContactPhone) {
        await tx.emergencyContact.create({
          data: {
            id: randomUUID(),
            patientId: existing.id,
            name: input.emergencyContactName,
            phone: input.emergencyContactPhone,
            relationship: input.emergencyContactRelationship ?? null,
            isPrimary: true,
          },
        });
      }
    }

    return tx.patient.findUniqueOrThrow({ where: { id: existing.id }, include: patientInclude });
  });

  return toPatientProfile(updated);
}

/**
 * Lista de pacientes. Un paciente solo puede verse a sí mismo; el psicólogo y el
 * administrador ven el directorio completo de cuentas activas.
 */
export async function listPatients(auth: AuthenticatedUser): Promise<Patient[]> {
  const where: Prisma.PatientWhereInput = { user: { isActive: true } };

  if (auth.role === UserRole.PATIENT) {
    where.userId = auth.id;
  }

  const rows = await prisma.patient.findMany({
    where,
    include: patientInclude,
    orderBy: { user: { name: "asc" } },
  });

  return rows.map(toPatient);
}

export async function getPatientById(id: string, auth: AuthenticatedUser): Promise<Patient> {
  const row = await prisma.patient.findUnique({ where: { id }, include: patientInclude });

  if (!row) {
    throw AppError.notFound("El paciente no existe");
  }

  if (auth.role === UserRole.PATIENT && row.userId !== auth.id) {
    throw AppError.forbidden("No puedes consultar el expediente de otro paciente");
  }

  return toPatient(row);
}
