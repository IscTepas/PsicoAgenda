import { Router } from "express";
import { idParamSchema } from "@psicoagenda/shared";
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from "@/controllers/notification.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

router.get("/", requireAuth, listNotificationsController);
// `read-all` va antes que `/:id` para que no lo capture el parámetro.
router.post("/read-all", requireAuth, markAllNotificationsReadController);
router.post("/:id/read", requireAuth, validate({ params: idParamSchema }), markNotificationReadController);

export default router;
