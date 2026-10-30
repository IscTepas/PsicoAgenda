import { Router } from "express";
import {
  addGuardianSchema,
  createLogEntrySchema,
  guardianParamsSchema,
  removeGuardianQuerySchema,
  UserRole,
  idParamSchema,
  patientListQuerySchema,
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
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import {
  addGuardianController,
  listGuardiansController,
  listTutoredPatientsController,
  removeGuardianController,
  setPrimaryGuardianController,
} from "@/controllers/guardianship.controller";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// `me` va antes que `/:id` para que no lo capture el parámetro.
router.get("/me", requireAuth, getMyPatientController);
// Menores que tutela la cuenta (para agendar a su nombre).
router.get("/me/tutelados", requireAuth, listTutoredPatientsController);
router.patch(
  "/me",
  requireAuth,
  validate({ body: updatePatientProfileSchema }),
  updateMyPatientController,
);

// Lista y detalle son legibles por cualquier sesión válida; el servicio acota lo
// que ve un paciente (solo su propio registro). La query se valida para que
// `limit`/`offset`/`page` lleguen como números y no reventen Prisma.
router.get("/", requireAuth, validate({ query: patientListQuerySchema }), listPatientsController);
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

// Tutores del paciente: los gestiona el psicólogo tratante (o administración)
// desde el expediente; el tutor no ve contenido clínico.
const gestionTutores = [requireAuth, requireRole(UserRole.PSYCHOLOGIST, UserRole.ADMIN)];
router.get("/:id/tutores", ...gestionTutores, validate({ params: idParamSchema }), listGuardiansController);
router.post(
  "/:id/tutores",
  ...gestionTutores,
  validate({ params: idParamSchema, body: addGuardianSchema }),
  addGuardianController,
);
router.post(
  "/:id/tutores/:tutorId/principal",
  ...gestionTutores,
  validate({ params: guardianParamsSchema }),
  setPrimaryGuardianController,
);
router.delete(
  "/:id/tutores/:tutorId",
  ...gestionTutores,
  validate({ params: guardianParamsSchema, query: removeGuardianQuerySchema }),
  removeGuardianController,
);

export default router;
