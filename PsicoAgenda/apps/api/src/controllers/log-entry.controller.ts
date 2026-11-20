import type { RequestHandler } from "express";
import { contextoDe } from "@/lib/auditoria";
import {
  cerrarNota,
  crearAclaracion,
  createLogEntry,
  listLogEntries,
  updateLogEntry,
  verificarNota,
  type CreateLogEntryInput,
  type UpdateLogEntryInput,
} from "@/services/log-entry.service";
import type { AuthedRequest } from "@/types/express";

const manejar =
  (fn: (req: AuthedRequest, res: Parameters<RequestHandler>[1]) => Promise<void>): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req as AuthedRequest, res);
    } catch (error) {
      next(error);
    }
  };

const idDe = (req: AuthedRequest) => (req.params as { id: string }).id;

export const listLogEntriesController = manejar(async (req, res) => {
  res.json(await listLogEntries(req.auth!, idDe(req), contextoDe(req)));
});

export const createLogEntryController = manejar(async (req, res) => {
  res.status(201).json(await createLogEntry(req.auth!, idDe(req), req.body as CreateLogEntryInput, contextoDe(req)));
});

export const updateLogEntryController = manejar(async (req, res) => {
  res.json(await updateLogEntry(req.auth!, idDe(req), req.body as UpdateLogEntryInput, contextoDe(req)));
});

export const closeLogEntryController = manejar(async (req, res) => {
  const { password } = req.body as { password: string };
  res.json(await cerrarNota(req.auth!, idDe(req), password, contextoDe(req)));
});

export const clarifyLogEntryController = manejar(async (req, res) => {
  res.status(201).json(await crearAclaracion(req.auth!, idDe(req), req.body as { text: string; password: string }, contextoDe(req)));
});

export const verifyLogEntryController = manejar(async (req, res) => {
  res.json(await verificarNota(req.auth!, idDe(req)));
});
