import { Router } from "express";
import { idParamSchema, updatePsychologistProfileSchema } from "@psicoagenda/shared";
import {
  getMyPsychologistController,
  getPsychologistController,
  updateMyPsychologistController,
} from "@/controllers/psychologist.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// `me` va antes que `/:id` para que no lo capture el parámetro.
router.get("/me", requireAuth, getMyPsychologistController);
router.patch(
  "/me",
  requireAuth,
  validate({ body: updatePsychologistProfileSchema }),
  updateMyPsychologistController,
);
router.get("/:id", requireAuth, validate({ params: idParamSchema }), getPsychologistController);

export default router;
