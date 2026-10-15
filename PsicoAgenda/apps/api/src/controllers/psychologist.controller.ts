import type { RequestHandler } from "express";
import {
  getMyPsychologistProfile,
  getPsychologistById,
  updateMyPsychologistProfile,
  type UpdatePsychologistProfileInput,
} from "@/services/psychologist.service";
import type { AuthedRequest } from "@/types/express";

export const getMyPsychologistController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getMyPsychologistProfile(req.auth!));
  } catch (error) {
    next(error);
  }
};

export const getPsychologistController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getPsychologistById(id));
  } catch (error) {
    next(error);
  }
};

export const updateMyPsychologistController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const input = req.body as UpdatePsychologistProfileInput;
    res.json(await updateMyPsychologistProfile(req.auth!, input));
  } catch (error) {
    next(error);
  }
};
