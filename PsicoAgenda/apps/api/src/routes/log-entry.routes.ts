import { Router } from "express";
import {
  confirmarConContrasenaSchema,
  idParamSchema,
  notaAclaratoriaSchema,
  updateLogEntrySchema,
} from "@psicoagenda/shared";
import {
  clarifyLogEntryController,
  closeLogEntryController,
  updateLogEntryController,
  verifyLogEntryController,
} from "@/controllers/log-entry.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

router.patch(
  "/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateLogEntrySchema }),
  updateLogEntryController,
);
// Cerrar (sellar) la nota: pide la contraseña.
router.post(
  "/:id/cerrar",
  requireAuth,
  validate({ params: idParamSchema, body: confirmarConContrasenaSchema }),
  closeLogEntryController,
);
// Nota aclaratoria sobre una nota cerrada.
router.post(
  "/:id/aclaracion",
  requireAuth,
  validate({ params: idParamSchema, body: notaAclaratoriaSchema }),
  clarifyLogEntryController,
);
router.get("/:id/verificar", requireAuth, validate({ params: idParamSchema }), verifyLogEntryController);

export default router;
