import type { RequestHandler } from "express";
import { origenDe } from "@/controllers/registro.controller";
import { crearInvitacion, crearPacienteCitaUnica, leerInvitacion, type CitaUnicaInput } from "@/services/cita-unica.service";
import { limitarConsultasDeCorreo } from "@/services/codigo.service";
import type { AuthedRequest } from "@/types/express";

export const crearPacienteCitaUnicaController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.status(201).json(await crearPacienteCitaUnica(req.auth!, req.body as CitaUnicaInput));
  } catch (error) {
    next(error);
  }
};

export const crearInvitacionController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.status(201).json(await crearInvitacion(req.auth!, id));
  } catch (error) {
    next(error);
  }
};

/** Prellenado público del registro; mismo límite por conexión que la consulta de correo. */
export const leerInvitacionController: RequestHandler = async (req, res, next) => {
  try {
    const { token } = req.query as { token: string };
    await limitarConsultasDeCorreo(origenDe(req));
    res.json(await leerInvitacion(token));
  } catch (error) {
    next(error);
  }
};
