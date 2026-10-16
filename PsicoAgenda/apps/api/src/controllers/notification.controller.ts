import type { RequestHandler } from "express";
import { listNotifications } from "@/services/notification.service";
import type { AuthedRequest } from "@/types/express";

export const listNotificationsController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.json(await listNotifications(req.auth!));
  } catch (error) {
    next(error);
  }
};
