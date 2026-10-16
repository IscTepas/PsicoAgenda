import { Router } from "express";
import {
  createLogEntrySchema,
  idParamSchema,
  updatePatientProfileSchema,
} from "@psicoagenda/shared";
import {
  getMyPatientController,
  getPatientController,
  listPatientsController,
  updateMyPatientController,
} from "@/controllers/patient.controller";
import { getClinicalRecordController } from "@/controllers/clinical-record.controller";
import {
  createLogEntryController,
  listLogEntriesController,
} from "@/controllers/log-entry.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// `me` va antes que `/:id` para que no lo capture el parámetro.
router.get("/me", requireAuth, getMyPatientController);
router.patch(
  "/me",
  requireAuth,
  validate({ body: updatePatientProfileSchema }),
  updateMyPatientController,
);

// Lista y detalle son legibles por cualquier sesión válida; el servicio acota lo
// que ve un paciente (solo su propio registro).
router.get("/", requireAuth, listPatientsController);
router.get("/:id", requireAuth, validate({ params: idParamSchema }), getPatientController);

// Expediente clínico y bitácora: exclusivos del profesional dueño del paciente.
router.get(
  "/:id/clinical-record",
  requireAuth,
  validate({ params: idParamSchema }),
  getClinicalRecordController,
);
router.get(
  "/:id/log-entries",
  requireAuth,
  validate({ params: idParamSchema }),
  listLogEntriesController,
);
router.post(
  "/:id/log-entries",
  requireAuth,
  validate({ params: idParamSchema, body: createLogEntrySchema }),
  createLogEntryController,
);

export default router;
