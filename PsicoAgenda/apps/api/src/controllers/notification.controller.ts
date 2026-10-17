import type { RequestHandler } from "express";
import { listNotifications } from "@/services/notification.service";
import type { AuthedRequest } from "@/types/express";

export const listNotificationsController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    res.json(
      await listNotifications(
        req.auth!,
        limit && limit > 0 && limit <= 100 ? limit : 50,
      ),
    );
  } catch (error) {
    next(error);
  }
};
