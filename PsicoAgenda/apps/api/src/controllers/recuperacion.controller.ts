import type { RequestHandler } from "express";
import { origenDe } from "@/controllers/registro.controller";
import { confirmarRecuperacion, solicitarRecuperacion } from "@/services/recuperacion.service";

export const solicitarRecuperacionController: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as { email: string };
    await solicitarRecuperacion(email, origenDe(req));
    res.status(202).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const confirmarRecuperacionController: RequestHandler = async (req, res, next) => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    await confirmarRecuperacion(token, password);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
