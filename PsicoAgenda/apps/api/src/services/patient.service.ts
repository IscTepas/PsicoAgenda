import { randomUUID } from "node:crypto";
import { UserRole, type Patient } from "@psicoagenda/shared";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";
import type { UpdatePatientProfileInput } from "@/types/patient";

const patientInclude = {
  user: true,
  legalGuardian: true,
  emergencyContacts: {
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
  },
};

function computeIsMinor(birthDate: Date | null): boolean {
  if (!birthDate) return false;
  const eighteenthBirthday = new Date(birthDate);
  eighteenthBirthday.setFullYear(birthDate.getFullYear() + 18);
  return eighteenthBirthday > new Date();
}

export function toPatient(row: {
  id: string;
  birthDate: Date | null;
  gender: string | null;
  address: string | null;
  psychologistId: string | null;
  legalGuardian: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    documentId: string | null;
    relationship: string | null;
    createdAt: Date;
  } | null;
  emergencyContacts: {
    id: string;
    patientId: string;
    name: string;
    phone: string;
    relationship: string | null;
    isPrimary: boolean;
    createdAt: Date;
  }[];
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}): Patient {
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
    emergencyContact: primaryContact
      ? {
          id: primaryContact.id,
          patientId: primaryContact.patientId,
          name: primaryContact.name,
          phone: primaryContact.phone,
          relationship: primaryContact.relationship ?? undefined,
          isPrimary: primaryContact.isPrimary,
          createdAt: primaryContact.createdAt,
        }
      : undefined,
    legalGuardian: row.legalGuardian
      ? {
          id: row.legalGuardian.id,
          name: row.legalGuardian.name,
          email: row.legalGuardian.email ?? undefined,
          phone: row.legalGuardian.phone ?? undefined,
          documentId: row.legalGuardian.documentId ?? undefined,
          relationship: row.legalGuardian.relationship ?? undefined,
          createdAt: row.legalGuardian.createdAt,
        }
      : undefined,
    createdAt: row.user.createdAt,
    updatedAt: row.user.updatedAt,
  };
}

/** Perfil del paciente autenticado (incluye preferencias de la cuenta). */
export async function getMyPatientProfile(auth: AuthenticatedUser) {
  const row = await prisma.patient.findUnique({
    where: { userId: auth.id },
    include: patientInclude,
  });
  if (!row) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }
  return toPatient(row);
}

const emptyToNull = (value: string | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  return value.trim() === "" ? null : value;
};

export async function updateMyPatientProfile(
  auth: AuthenticatedUser,
  input: UpdatePatientProfileInput,
) {
  const existing = await prisma.patient.findUnique({
    where: { userId: auth.id },
    select: { id: true },
  });
  if (!existing) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const userData: Record<string, unknown> = {};
    if (input.name !== undefined) userData.name = input.name;
    if (input.phone !== undefined) userData.phone = emptyToNull(input.phone);
    if (input.timeZone !== undefined) userData.timeZone = input.timeZone;
    if (input.photoUrl !== undefined)
      userData.photoUrl = emptyToNull(input.photoUrl);
    if (input.notifyWhatsapp !== undefined)
      userData.notifyWhatsapp = input.notifyWhatsapp;
    if (input.notifyEmail !== undefined)
      userData.notifyEmail = input.notifyEmail;
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: auth.id }, data: userData });
    }

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
    return tx.patient.findUniqueOrThrow({
      where: { id: existing.id },
      include: patientInclude,
    });
  });
  return toPatient(updated);
}

/**
 * Lista de pacientes. Un paciente solo puede verse a sí mismo; el psicólogo y el
 * administrador ven el directorio completo de cuentas activas.
 */
export async function listPatients(auth: AuthenticatedUser): Promise<Patient[]> {
  const where: Record<string, unknown> = { user: { isActive: true } };
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

export async function getPatientById(
  id: string,
  auth: AuthenticatedUser,
): Promise<Patient> {
  const row = await prisma.patient.findUnique({
    where: { id },
    include: patientInclude,
  });
  if (!row) {
    throw AppError.notFound("El paciente no existe");
  }
  if (auth.role === UserRole.PATIENT && row.userId !== auth.id) {
    throw AppError.forbidden("No puedes consultar el expediente de otro paciente");
  }
  return toPatient(row);
}
