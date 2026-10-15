import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import authRouter from "@/routes/auth.routes";
import patientsRouter from "@/routes/patient.routes";
import appointmentsRouter from "@/routes/appointment.routes";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/patients", patientsRouter);
router.use("/appointments", appointmentsRouter);

export { router as apiRouter };
