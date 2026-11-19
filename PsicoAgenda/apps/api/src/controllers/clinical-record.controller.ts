import type { RequestHandler } from "express";
import {
  getOrCreateClinicalRecord,
  registrarConsentimiento,
  retirarConsentimiento,
  updateClinicalRecord,
  type CreateConsentInput,
  type UpdateClinicalRecordInput,
} from "@/services/clinical-record.service";
import type { AuthedRequest } from "@/types/express";

export const createConsentController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.status(201).json(await registrarConsentimiento(req.auth!, id, req.body as CreateConsentInput));
  } catch (error) {
    next(error);
  }
};

export const withdrawConsentController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id, consentId } = req.params as { id: string; consentId: string };
    res.json(await retirarConsentimiento(req.auth!, id, consentId));
  } catch (error) {
    next(error);
  }
};

export const getClinicalRecordController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getOrCreateClinicalRecord(req.auth!, id));
  } catch (error) {
    next(error);
  }
};

export const updateClinicalRecordController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await updateClinicalRecord(req.auth!, id, req.body as UpdateClinicalRecordInput));
  } catch (error) {
    next(error);
  }
};
