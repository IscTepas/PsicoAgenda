import type { RequestHandler } from "express";
import {
  addGuardian,
  addTutoredMinor,
  assertCanActOnPatient,
  listGuardians,
  listTutoredPatients,
  removeGuardian,
  setPrimaryGuardian,
  type AddGuardianInput,
  type AddTutoredMinorInput,
} from "@/services/guardianship.service";
import { listMyTasks, setTaskDone } from "@/services/task.service";
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

export const addTutoredMinorController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.status(201).json(await addTutoredMinor(req.auth!, req.body as AddTutoredMinorInput));
  } catch (error) {
    next(error);
  }
};

export const listMyTasksController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.json(await listMyTasks(req.auth!));
  } catch (error) {
    next(error);
  }
};

export const setTaskDoneController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as Params;
    res.json(await setTaskDone(req.auth!, id, (req.body as { done: boolean }).done));
  } catch (error) {
    next(error);
  }
};
