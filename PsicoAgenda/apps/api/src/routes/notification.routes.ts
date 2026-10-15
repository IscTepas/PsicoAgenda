import { Router } from "express";
import { listNotificationsController } from "@/controllers/notification.controller";
import { requireAuth } from "@/middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listNotificationsController);

export default router;
