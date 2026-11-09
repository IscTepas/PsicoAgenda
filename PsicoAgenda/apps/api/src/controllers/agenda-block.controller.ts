import type { RequestHandler } from "express";
import {
  createAgendaBlock,
  deleteAgendaBlock,
  listAgendaBlocks,
  type CreateAgendaBlockInput,
  type ListAgendaBlocksFilter,
} from "@/services/agenda-block.service";
import type { AuthedRequest } from "@/types/express";

export const listAgendaBlocksController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    // `validate` ya parseó el rango; los alias from/to viven en el servicio.
    const filter = req.query as unknown as ListAgendaBlocksFilter;
    res.json(await listAgendaBlocks(req.auth!, filter));
  } catch (error) {
    next(error);
  }
};

export const createAgendaBlockController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const created = await createAgendaBlock(req.auth!, req.body as CreateAgendaBlockInput);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const deleteAgendaBlockController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    await deleteAgendaBlock(req.auth!, id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
