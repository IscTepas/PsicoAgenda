import { AppointmentModality } from "../types/index.js";

export interface PricingInput {
  isMinor: boolean;
  startTime: Date;
  modality: AppointmentModality;
  durationMinutes: number;
}

/** Tarifas que cada psicólogo configura en su perfil. Montos en pesos enteros. */
export interface PricingRates {
  /** Tarifa base de una sesión de adulto. */
  adultRate: number;
  /** Tarifa base de una sesión de menor de edad (30 min). */
  minorRate: number;
  /** Recargo, en porcentaje, cuando la cita es para el mismo día (emergencia). */
  sameDaySurchargePercent: number;
  /** Recargo del mismo día como monto fijo; si tiene valor, sustituye al porcentaje. */
  sameDaySurchargeAmount: number | null;
  /** Descuento fijo por modalidad virtual. */
  virtualDiscount: number;
}

/** Tarifas con las que nace un perfil; coinciden con los DEFAULT de la migración. */
export const DEFAULT_PRICING_RATES: PricingRates = {
  adultRate: 800,
  minorRate: 1000,
  sameDaySurchargePercent: 30,
  sameDaySurchargeAmount: null,
  virtualDiscount: 100,
};

/**
 * Precio de una cita: tarifa base según edad, recargo si es el mismo día y
 * descuento si es virtual, en ese orden. Nunca baja de cero.
 */
export function calculateAppointmentPrice(
  input: PricingInput,
  rates: PricingRates = DEFAULT_PRICING_RATES,
): number {
  const { isMinor, startTime, modality } = input;
  let base = isMinor ? rates.minorRate : rates.adultRate;
  const now = new Date();
  const sameDay =
    now.getFullYear() === startTime.getFullYear() &&
    now.getMonth() === startTime.getMonth() &&
    now.getDate() === startTime.getDate();
  if (sameDay) {
    base =
      rates.sameDaySurchargeAmount != null
        ? base + rates.sameDaySurchargeAmount
        : Math.round(base * (1 + rates.sameDaySurchargePercent / 100));
  }
  if (modality === AppointmentModality.VIRTUAL) base = base - rates.virtualDiscount;
  if (base < 0) base = 0;
  return base;
}

/** Los menores de edad solo pueden tener sesiones de 30 minutos. */
export function getEffectiveDurationMinutes(isMinor: boolean, durationMinutes: number): number {
  if (isMinor) return 30;
  return durationMinutes;
}

/**
 * Motivos de consulta que no aplican a un menor de edad (códigos del catálogo
 * `motivos_consulta`).
 */
// shortcut: lista fija; si la psicóloga necesita cambiarla, pasa a una columna del catálogo.
export const ADULT_ONLY_REASON_CODES: readonly string[] = ["pareja", "crianza", "estres_laboral"];

export const isReasonAllowedFor = (code: string, isMinor: boolean): boolean =>
  !isMinor || !ADULT_ONLY_REASON_CODES.includes(code);
