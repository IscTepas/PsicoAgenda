import type { RequestHandler } from "express";
import {
  getMyPatientProfile,
  getPatientById,
  listPatients,
  updateMyPatientProfile,
  type UpdatePatientProfileInput,
} from "@/services/patient.service";
import type { AuthedRequest } from "@/types/express";

export const getMyPatientController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getMyPatientProfile(req.auth!));
  } catch (error) {
    next(error);
  }
};

export const updateMyPatientController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const input = req.body as UpdatePatientProfileInput;
    res.json(await updateMyPatientProfile(req.auth!, input));
  } catch (error) {
    next(error);
  }
};

export const listPatientsController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    // `requireAuth` ya garantizó que `auth` existe.
    res.json(await listPatients(req.auth!));
  } catch (error) {
    next(error);
  }
};

export const getPatientController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getPatientById(id, req.auth!));
  } catch (error) {
    next(error);
  }
};
