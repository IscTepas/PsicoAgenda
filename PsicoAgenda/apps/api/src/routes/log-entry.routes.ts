import { Router } from "express";
import { idParamSchema, updateLogEntrySchema } from "@psicoagenda/shared";
import { updateLogEntryController } from "@/controllers/log-entry.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

router.patch(
  "/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateLogEntrySchema }),
  updateLogEntryController,
);

export default router;
