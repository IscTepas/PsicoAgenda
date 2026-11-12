import { UserRole, type PricingRates, type PsychologistProfile } from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

const psychologistInclude = {
  usuarios: true,
} satisfies Prisma.psicologosInclude;

type PsychologistRow = Prisma.psicologosGetPayload<{ include: typeof psychologistInclude }>;

/** Columnas de tarifas → forma compartida con el cálculo de precios. */
export const toPricingRates = (
  row: Pick<
    PsychologistRow,
    "tarifa_adulto" | "tarifa_menor" | "recargo_mismo_dia_pct" | "recargo_mismo_dia_monto" | "descuento_virtual"
  >,
): PricingRates => ({
  adultRate: row.tarifa_adulto,
  minorRate: row.tarifa_menor,
  sameDaySurchargePercent: row.recargo_mismo_dia_pct,
  sameDaySurchargeAmount: row.recargo_mismo_dia_monto,
  virtualDiscount: row.descuento_virtual,
});

function toProfile(row: PsychologistRow): PsychologistProfile {
  const { usuarios: user } = row;

  return {
    id: user.id,
    email: user.correo,
    name: user.nombre_completo,
    phone: user.telefono ?? undefined,
    role: UserRole.PSYCHOLOGIST,
    licenseNumber: row.cedula_profesional,
    specialty: row.especialidad ?? undefined,
    bio: row.biografia ?? undefined,
    rates: toPricingRates(row),
    timeZone: user.zona_horaria,
    photoUrl: user.foto_perfil_url ?? undefined,
    notifyWhatsapp: user.notificar_whatsapp,
    notifyEmail: user.notificar_correo,
    createdAt: user.creado_en,
    updatedAt: user.actualizado_en,
  };
}

/** Resuelve el id de perfil de psicólogo a partir del id de usuario. */
export async function requirePsychologistIdByUser(userId: string): Promise<string> {
  const psychologist = await prisma.psicologos.findUnique({
    where: { usuario_id: userId },
    select: { id: true },
  });

  if (!psychologist) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }

  return psychologist.id;
}

const emptyToNull = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : value.trim() === "" ? null : value;

/** Perfil del psicólogo autenticado. */
export async function getMyPsychologistProfile(auth: AuthenticatedUser): Promise<PsychologistProfile> {
  const row = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    include: psychologistInclude,
  });

  if (!row) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }

  return toProfile(row);
}

/** Perfil de un psicólogo por su identificador de perfil (no el de usuario). */
export async function getPsychologistById(id: string): Promise<PsychologistProfile> {
  const row = await prisma.psicologos.findUnique({ where: { id }, include: psychologistInclude });

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
  rates?: PricingRates;
}

export async function updateMyPsychologistProfile(
  auth: AuthenticatedUser,
  input: UpdatePsychologistProfileInput,
): Promise<PsychologistProfile> {
  const existing = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    select: { id: true },
  });

  if (!existing) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
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

    const psychologistData: Prisma.psicologosUpdateInput = {};
    if (input.licenseNumber !== undefined) psychologistData.cedula_profesional = input.licenseNumber;
    if (input.specialty !== undefined) psychologistData.especialidad = emptyToNull(input.specialty);
    if (input.bio !== undefined) psychologistData.biografia = emptyToNull(input.bio);
    if (input.rates) {
      psychologistData.tarifa_adulto = input.rates.adultRate;
      psychologistData.tarifa_menor = input.rates.minorRate;
      psychologistData.recargo_mismo_dia_pct = input.rates.sameDaySurchargePercent;
      psychologistData.recargo_mismo_dia_monto = input.rates.sameDaySurchargeAmount;
      psychologistData.descuento_virtual = input.rates.virtualDiscount;
    }

    return tx.psicologos.update({
      where: { id: existing.id },
      data: psychologistData,
      include: psychologistInclude,
    });
  });

  return toProfile(updated);
}
