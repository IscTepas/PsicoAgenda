import type { RequestHandler } from "express";
import { getPsychologistSchedule, replacePsychologistSchedule } from "@/services/psychologist-schedule.service";
import { requirePsychologistIdByUser } from "@/services/psychologist.service";
import type { AuthedRequest } from "@/types/express";

/** Horario del psicólogo autenticado. */
export const getMyScheduleController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const psychologistId = await requirePsychologistIdByUser(req.auth!.id);
    res.json(await getPsychologistSchedule(psychologistId));
  } catch (error) {
    next(error);
  }
};

/** El psicólogo autenticado guarda su horario semanal completo. */
export const updateMyScheduleController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const psychologistId = await requirePsychologistIdByUser(req.auth!.id);
    const { slots } = req.body as { slots: { dayOfWeek: number; hour: number }[] };
    res.json(await replacePsychologistSchedule(psychologistId, slots));
  } catch (error) {
    next(error);
  }
};

/** Horario de un psicólogo por su id de perfil. */
export const getPsychologistScheduleController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getPsychologistSchedule(id));
  } catch (error) {
    next(error);
  }
};
