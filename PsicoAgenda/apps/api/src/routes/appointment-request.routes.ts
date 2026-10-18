import { Router } from "express";
import {
  appointmentRequestListQuerySchema,
  createAppointmentRequestSchema,
  idParamSchema,
  UserRole,
} from "@psicoagenda/shared";
import {
  acceptAppointmentRequestController,
  cancelAppointmentRequestController,
  createAppointmentRequestController,
  listAppointmentRequestsController,
  rejectAppointmentRequestController,
} from "@/controllers/appointment-request.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

router.get(
  "/",
  requireAuth,
  validate({ query: appointmentRequestListQuerySchema }),
  listAppointmentRequestsController,
);
router.post(
  "/",
  requireAuth,
  requireRole(UserRole.PATIENT),
  validate({ body: createAppointmentRequestSchema }),
  createAppointmentRequestController,
);
router.post(
  "/:id/accept",
  requireAuth,
  requireRole(UserRole.PSYCHOLOGIST, UserRole.ADMIN),
  validate({ params: idParamSchema }),
  acceptAppointmentRequestController,
);
router.post(
  "/:id/reject",
  requireAuth,
  requireRole(UserRole.PSYCHOLOGIST, UserRole.ADMIN),
  validate({ params: idParamSchema }),
  rejectAppointmentRequestController,
);
router.post(
  "/:id/cancel",
  requireAuth,
  requireRole(UserRole.PATIENT),
  validate({ params: idParamSchema }),
  cancelAppointmentRequestController,
);

export default router;
