import type { RequestHandler } from "express";
import {
  createReason,
  deleteReason,
  listActiveReasons,
  listAllReasons,
  updateReason,
  type ReasonInput,
} from "@/services/consultation-reason.service";

const manejar =
  (fn: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };

export const listActiveReasonsController = manejar(async (_req, res) => {
  res.json(await listActiveReasons());
});

export const listAllReasonsController = manejar(async (_req, res) => {
  res.json(await listAllReasons());
});

export const createReasonController = manejar(async (req, res) => {
  res.status(201).json(await createReason(req.body as Parameters<typeof createReason>[0]));
});

export const updateReasonController = manejar(async (req, res) => {
  const { id } = req.params as { id: string };
  res.json(await updateReason(id, req.body as ReasonInput));
});

export const deleteReasonController = manejar(async (req, res) => {
  const { id } = req.params as { id: string };
  await deleteReason(id);
  res.status(204).end();
});
