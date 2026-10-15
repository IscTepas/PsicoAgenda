import type { RequestHandler } from "express";
import {
  createLogEntry,
  listLogEntries,
  updateLogEntry,
  type CreateLogEntryInput,
  type UpdateLogEntryInput,
} from "@/services/log-entry.service";
import type { AuthedRequest } from "@/types/express";

export const listLogEntriesController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await listLogEntries(req.auth!, id));
  } catch (error) {
    next(error);
  }
};

export const createLogEntryController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const created = await createLogEntry(req.auth!, id, req.body as CreateLogEntryInput);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const updateLogEntryController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await updateLogEntry(req.auth!, id, req.body as UpdateLogEntryInput));
  } catch (error) {
    next(error);
  }
};
