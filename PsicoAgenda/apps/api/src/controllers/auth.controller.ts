import type { RequestHandler } from "express";
import type { UserRole } from "@psicoagenda/shared";
import { demoLogin } from "@/services/auth.service";

export const demoLoginController: RequestHandler = (req, res) => {
  const { role } = req.body as { role: UserRole.PATIENT | UserRole.PSYCHOLOGIST };
  res.json(demoLogin(role));
};
