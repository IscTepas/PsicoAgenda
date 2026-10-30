import { Router } from "express";
import {
  createConsultationReasonSchema,
  idParamSchema,
  updateConsultationReasonSchema,
  UserRole,
} from "@psicoagenda/shared";
import {
  createReasonController,
  deleteReasonController,
  listActiveReasonsController,
  listAllReasonsController,
  updateReasonController,
} from "@/controllers/consultation-reason.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();
const soloAdmin = [requireAuth, requireRole(UserRole.ADMIN)];

// Lo que ofrecen los selectores de cita y solicitud: solo activos, agrupados.
router.get("/", requireAuth, listActiveReasonsController);

// Administración del catálogo (incluye inactivos).
router.get("/todos", ...soloAdmin, listAllReasonsController);
router.post("/", ...soloAdmin, validate({ body: createConsultationReasonSchema }), createReasonController);
router.patch(
  "/:id",
  ...soloAdmin,
  validate({ params: idParamSchema, body: updateConsultationReasonSchema }),
  updateReasonController,
);
router.delete("/:id", ...soloAdmin, validate({ params: idParamSchema }), deleteReasonController);

export default router;
