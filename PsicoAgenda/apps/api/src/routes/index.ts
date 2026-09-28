import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";

const router = Router();

router.use("/health", healthRouter);

export { router as apiRouter };
