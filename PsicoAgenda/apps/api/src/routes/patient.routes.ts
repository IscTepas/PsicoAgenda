import { Router } from "express";
import {
  idParamSchema,
  updatePatientProfileSchema,
} from "@psicoagenda/shared";
import {
  getMyPatientController,
  getPatientController,
  listPatientsController,
  updateMyPatientController,
} from "@/controllers/patient.controller";
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
router.get(
  "/:id",
  requireAuth,
  validate({ params: idParamSchema }),
  getPatientController,
);

export default router;
