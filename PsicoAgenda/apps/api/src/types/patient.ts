import type { z } from "zod";
import type { updatePatientProfileSchema } from "@psicoagenda/shared";

export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
