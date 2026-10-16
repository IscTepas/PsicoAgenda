import type { RequestHandler } from "express";
import { getOrCreateClinicalRecord } from "@/services/clinical-record.service";
import type { AuthedRequest } from "@/types/express";

export const getClinicalRecordController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getOrCreateClinicalRecord(req.auth!, id));
  } catch (error) {
    next(error);
  }
};
