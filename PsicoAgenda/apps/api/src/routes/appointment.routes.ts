import { Router } from "express";
import {
  appointmentListQuerySchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  idParamSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
} from "@psicoagenda/shared";
import {
  cancelAppointmentController,
  changeAppointmentStatusController,
  createAppointmentController,
  getAppointmentController,
  listAppointmentsController,
  updateAppointmentController,
} from "@/controllers/appointment.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

router.get("/", requireAuth, validate({ query: appointmentListQuerySchema }), listAppointmentsController);
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

export default router;
