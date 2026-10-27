import { AppointmentModality } from "../types/index.js";

export interface PricingInput {
  isMinor: boolean;
  startTime: Date;
  modality: AppointmentModality;
  durationMinutes: number;
}

/**
 * Reglas de precios: adultos $800, menores $1000 (sesión de 30 min),
 * +30% si la cita es el mismo día, −$100 por modalidad virtual.
 */
export function calculateAppointmentPrice(input: PricingInput): number {
  const { isMinor, startTime, modality } = input;
  let base = isMinor ? 1000 : 800;
  const now = new Date();
  const sameDay =
    now.getFullYear() === startTime.getFullYear() &&
    now.getMonth() === startTime.getMonth() &&
    now.getDate() === startTime.getDate();
  if (sameDay) base = Math.round(base * 1.3);
  if (modality === AppointmentModality.VIRTUAL) base = base - 100;
  if (base < 0) base = 0;
  return base;
}

/** Los menores de edad solo pueden tener sesiones de 30 minutos. */
export function getEffectiveDurationMinutes(isMinor: boolean, durationMinutes: number): number {
  if (isMinor) return 30;
  return durationMinutes;
}
