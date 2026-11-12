import { Router } from "express";
import {
  idParamSchema,
  updatePsychologistProfileSchema,
  updatePsychologistScheduleSchema,
} from "@psicoagenda/shared";
import {
  getMyPsychologistController,
  getPsychologistController,
  updateMyPsychologistController,
} from "@/controllers/psychologist.controller";
import {
  getMyScheduleController,
  getPsychologistScheduleController,
  updateMyScheduleController,
} from "@/controllers/psychologist-schedule.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// `me` va antes que `/:id` para que no lo capture el parametro.
router.get("/me", requireAuth, getMyPsychologistController);
router.patch(
  "/me",
  requireAuth,
  validate({ body: updatePsychologistProfileSchema }),
  updateMyPsychologistController,
);
router.get("/me/schedule", requireAuth, getMyScheduleController);
// Sin perfil de psicólogo el controlador responde 403, así que no hace falta `requireRole`.
router.put(
  "/me/schedule",
  requireAuth,
  validate({ body: updatePsychologistScheduleSchema }),
  updateMyScheduleController,
);
router.get(
  "/:id/schedule",
  requireAuth,
  validate({ params: idParamSchema }),
  getPsychologistScheduleController,
);
router.get("/:id", requireAuth, validate({ params: idParamSchema }), getPsychologistController);

export default router;
