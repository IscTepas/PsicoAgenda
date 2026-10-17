// La lógica de precios vive en `@psicoagenda/shared` para que el frontend
// muestre el mismo cálculo que persiste la API. Este módulo se conserva como
// punto de re-exportación para los imports existentes (`@/utils/pricing`).
export {
  calculateAppointmentPrice,
  getEffectiveDurationMinutes,
  type PricingInput,
} from "@psicoagenda/shared";
