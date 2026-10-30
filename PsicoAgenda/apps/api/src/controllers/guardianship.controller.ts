import type { RequestHandler } from "express";
import {
  addGuardian,
  assertCanActOnPatient,
  listGuardians,
  listTutoredPatients,
  removeGuardian,
  setPrimaryGuardian,
  type AddGuardianInput,
} from "@/services/guardianship.service";
import type { AuthedRequest } from "@/types/express";

type Params = { id: string; tutorId?: string };

export const listTutoredPatientsController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.json(await listTutoredPatients(req.auth!));
  } catch (error) {
    next(error);
  }
};

export const listGuardiansController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as Params;
    await assertCanActOnPatient(req.auth!, id);
    res.json(await listGuardians(id));
  } catch (error) {
    next(error);
  }
};

export const addGuardianController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as Params;
    res.status(201).json(await addGuardian(req.auth!, id, req.body as AddGuardianInput));
  } catch (error) {
    next(error);
  }
};

export const setPrimaryGuardianController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id, tutorId } = req.params as Required<Params>;
    res.json(await setPrimaryGuardian(req.auth!, id, tutorId));
  } catch (error) {
    next(error);
  }
};

export const removeGuardianController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id, tutorId } = req.params as Required<Params>;
    const { nuevoPrincipalId, sinPrincipal } = req.query as { nuevoPrincipalId?: string; sinPrincipal?: string };
    res.json(await removeGuardian(req.auth!, id, tutorId, { nuevoPrincipalId, sinPrincipal: sinPrincipal === "true" }));
  } catch (error) {
    next(error);
  }
};
