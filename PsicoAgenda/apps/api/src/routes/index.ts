import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import authRouter from "@/routes/auth.routes";
import patientsRouter from "@/routes/patient.routes";
import appointmentsRouter from "@/routes/appointment.routes";
import psychologistsRouter from "@/routes/psychologist.routes";
import notificationsRouter from "@/routes/notification.routes";
import logEntriesRouter from "@/routes/log-entry.routes";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/patients", patientsRouter);
router.use("/appointments", appointmentsRouter);
router.use("/psychologists", psychologistsRouter);
router.use("/notifications", notificationsRouter);
router.use("/log-entries", logEntriesRouter);

export { router as apiRouter };
