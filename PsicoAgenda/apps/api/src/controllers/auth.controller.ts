import type { RequestHandler } from "express";
import { getProfileById } from "@/services/auth.service";
import type { AuthedRequest } from "@/types/express";

export const meController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    // `requireAuth` ya validó la firma y garantizó que `auth` existe.
    res.json(await getProfileById(req.auth!.id));
  } catch (error) {
    next(error);
  }
};
