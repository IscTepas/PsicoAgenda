import { UserRole, type PsychologistProfile } from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

const psychologistInclude = {
  user: true,
} satisfies Prisma.PsychologistInclude;

type PsychologistRow = Prisma.PsychologistGetPayload<{ include: typeof psychologistInclude }>;

function toProfile(row: PsychologistRow): PsychologistProfile {
  const { user } = row;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? undefined,
    role: UserRole.PSYCHOLOGIST,
    licenseNumber: row.licenseNumber,
    specialty: row.specialty ?? undefined,
    bio: row.bio ?? undefined,
    timeZone: user.timeZone,
    photoUrl: user.photoUrl ?? undefined,
    notifyWhatsapp: user.notifyWhatsapp,
    notifyEmail: user.notifyEmail,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const emptyToNull = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : value.trim() === "" ? null : value;

/** Perfil del psicólogo autenticado. */
export async function getMyPsychologistProfile(auth: AuthenticatedUser): Promise<PsychologistProfile> {
  const row = await prisma.psychologist.findUnique({
    where: { userId: auth.id },
    include: psychologistInclude,
  });

  if (!row) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }

  return toProfile(row);
}

/** Perfil de un psicólogo por su identificador de perfil (no el de usuario). */
export async function getPsychologistById(id: string): Promise<PsychologistProfile> {
  const row = await prisma.psychologist.findUnique({ where: { id }, include: psychologistInclude });

  if (!row) {
    throw AppError.notFound("El psicólogo no existe");
  }

  return toProfile(row);
}

export interface UpdatePsychologistProfileInput {
  name?: string;
  phone?: string;
  timeZone?: string;
  photoUrl?: string;
  notifyWhatsapp?: boolean;
  notifyEmail?: boolean;
  licenseNumber?: string;
  specialty?: string;
  bio?: string;
}

export async function updateMyPsychologistProfile(
  auth: AuthenticatedUser,
  input: UpdatePsychologistProfileInput,
): Promise<PsychologistProfile> {
  const existing = await prisma.psychologist.findUnique({
    where: { userId: auth.id },
    select: { id: true },
  });

  if (!existing) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
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

    const psychologistData: Prisma.PsychologistUpdateInput = {};
    if (input.licenseNumber !== undefined) psychologistData.licenseNumber = input.licenseNumber;
    if (input.specialty !== undefined) psychologistData.specialty = emptyToNull(input.specialty);
    if (input.bio !== undefined) psychologistData.bio = emptyToNull(input.bio);

    return tx.psychologist.update({
      where: { id: existing.id },
      data: psychologistData,
      include: psychologistInclude,
    });
  });

  return toProfile(updated);
}
