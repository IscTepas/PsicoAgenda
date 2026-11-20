import type { RequestHandler } from "express";
import { contextoDe } from "@/lib/auditoria";
import {
  cerrarHistoria,
  darDeBajaPaciente,
  enlaceDelConsentimiento,
  getOrCreateClinicalRecord,
  listarAuditoria,
  registrarConsentimiento,
  registrarImpresion,
  retirarConsentimiento,
  updateClinicalRecord,
  type CreateConsentInput,
  type UpdateClinicalRecordInput,
} from "@/services/clinical-record.service";
import type { AuthedRequest } from "@/types/express";

/** Envuelve un controlador async y manda los errores al manejador común. */
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

export const getClinicalRecordController = manejar(async (req, res) => {
  res.json(await getOrCreateClinicalRecord(req.auth!, idDe(req), contextoDe(req)));
});

export const updateClinicalRecordController = manejar(async (req, res) => {
  res.json(await updateClinicalRecord(req.auth!, idDe(req), req.body as UpdateClinicalRecordInput, contextoDe(req)));
});

export const closeClinicalHistoryController = manejar(async (req, res) => {
  const { password } = req.body as { password: string };
  res.json(await cerrarHistoria(req.auth!, idDe(req), password, contextoDe(req)));
});

export const createConsentController = manejar(async (req, res) => {
  res.status(201).json(await registrarConsentimiento(req.auth!, idDe(req), req.body as CreateConsentInput, contextoDe(req)));
});

export const withdrawConsentController = manejar(async (req, res) => {
  const { consentId } = req.params as { consentId: string };
  res.json(await retirarConsentimiento(req.auth!, idDe(req), consentId, contextoDe(req)));
});

export const consentPdfController = manejar(async (req, res) => {
  const { consentId } = req.params as { consentId: string };
  res.json({ url: await enlaceDelConsentimiento(req.auth!, idDe(req), consentId, contextoDe(req)) });
});

export const dischargePatientController = manejar(async (req, res) => {
  res.json(await darDeBajaPaciente(req.auth!, idDe(req), contextoDe(req)));
});

export const printRecordController = manejar(async (req, res) => {
  await registrarImpresion(req.auth!, idDe(req), contextoDe(req));
  res.status(204).end();
});

export const auditTrailController = manejar(async (req, res) => {
  res.json(await listarAuditoria(req.auth!, idDe(req)));
});
