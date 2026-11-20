import { Router } from "express";
import {
  appointmentRequestListQuerySchema,
  createAppointmentRequestSchema,
  idParamSchema,
  proponerCambioSchema,
  rescheduleAppointmentRequestSchema,
  responderPropuestaSchema,
  UserRole,
} from "@psicoagenda/shared";
import {
  acceptAppointmentRequestController,
  cancelAppointmentRequestController,
  createAppointmentRequestController,
  listAppointmentRequestsController,
  proposeChangeController,
  rejectAppointmentRequestController,
  respondProposalController,
  rescheduleAppointmentRequestController,
} from "@/controllers/appointment-request.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// La psicóloga propone otro horario para una cita; el paciente (o su tutor) responde.
router.post(
  "/propuesta",
  requireAuth,
  requireRole(UserRole.PSYCHOLOGIST, UserRole.ADMIN),
  validate({ body: proponerCambioSchema }),
  proposeChangeController,
);
router.post(
  "/:id/responder",
  requireAuth,
  requireRole(UserRole.PATIENT),
  validate({ params: idParamSchema, body: responderPropuestaSchema }),
  respondProposalController,
);

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
  "/reschedule",
  requireAuth,
  requireRole(UserRole.PATIENT),
  validate({ body: rescheduleAppointmentRequestSchema }),
  rescheduleAppointmentRequestController,
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
