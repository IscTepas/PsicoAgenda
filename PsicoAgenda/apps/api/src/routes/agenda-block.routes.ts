import { Router } from "express";
import {
  agendaBlockListQuerySchema,
  createAgendaBlockSchema,
  idParamSchema,
  UserRole,
} from "@psicoagenda/shared";
import {
  createAgendaBlockController,
  deleteAgendaBlockController,
  listAgendaBlocksController,
} from "@/controllers/agenda-block.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// El paciente puede leer la disponibilidad de su psicólogo; crear y borrar es
// exclusivo del profesional dueño (el servicio vuelve a comprobarlo).
router.get(
  "/",
  requireAuth,
  validate({ query: agendaBlockListQuerySchema }),
  listAgendaBlocksController,
);
router.post(
  "/",
  requireAuth,
  requireRole(UserRole.PSYCHOLOGIST),
  validate({ body: createAgendaBlockSchema }),
  createAgendaBlockController,
);
router.delete(
  "/:id",
  requireAuth,
  requireRole(UserRole.PSYCHOLOGIST),
  validate({ params: idParamSchema }),
  deleteAgendaBlockController,
);

export default router;
