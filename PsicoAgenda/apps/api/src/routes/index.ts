import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import authRouter from "@/routes/auth.routes";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);

export { router as apiRouter };
