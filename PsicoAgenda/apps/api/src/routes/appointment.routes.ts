import { Router } from "express";
import {
  appointmentListQuerySchema,
  appointmentOccupancyQuerySchema,
  cancelAppointmentSchema,
  closeAppointmentSchema,
  createAppointmentSchema,
  idParamSchema,
  updateAppointmentPaymentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
} from "@psicoagenda/shared";
import {
  cancelAppointmentController,
  changeAppointmentStatusController,
  closeAppointmentController,
  createAppointmentController,
  getAppointmentController,
  listAppointmentOccupancyController,
  listAppointmentsController,
  updateAppointmentController,
  updateAppointmentPaymentController,
} from "@/controllers/appointment.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

router.get("/", requireAuth, validate({ query: appointmentListQuerySchema }), listAppointmentsController);
router.get(
  "/occupancy",
  requireAuth,
  validate({ query: appointmentOccupancyQuerySchema }),
  listAppointmentOccupancyController,
);
router.get("/:id", requireAuth, validate({ params: idParamSchema }), getAppointmentController);
router.post("/", requireAuth, validate({ body: createAppointmentSchema }), createAppointmentController);
router.patch(
  "/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateAppointmentSchema }),
  updateAppointmentController,
);
router.patch(
  "/:id/status",
  requireAuth,
  validate({ params: idParamSchema, body: updateAppointmentStatusSchema }),
  changeAppointmentStatusController,
);
router.post(
  "/:id/cancel",
  requireAuth,
  validate({ params: idParamSchema, body: cancelAppointmentSchema }),
  cancelAppointmentController,
);
router.post(
  "/:id/close",
  requireAuth,
  validate({ params: idParamSchema, body: closeAppointmentSchema }),
  closeAppointmentController,
);
router.patch(
  "/:id/payment",
  requireAuth,
  validate({ params: idParamSchema, body: updateAppointmentPaymentSchema }),
  updateAppointmentPaymentController,
);

export default router;
