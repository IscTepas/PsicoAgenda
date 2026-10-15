import type {
  createAppointmentSchema,
  updateAppointmentSchema,
} from "@psicoagenda/shared";
import type { z } from "zod";

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
