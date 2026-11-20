import type { RequestHandler } from "express";
import type { AppointmentRequestStatus } from "@psicoagenda/shared";
import {
  acceptAppointmentRequest,
  cancelAppointmentRequest,
  createAppointmentRequest,
  listAppointmentRequests,
  proponerCambio,
  rejectAppointmentRequest,
  responderPropuesta,
  rescheduleAppointmentRequest,
  type CreateAppointmentRequestInput,
  type ProponerCambioInput,
  type RescheduleAppointmentRequestInput,
} from "@/services/appointment-request.service";
import type { AuthedRequest } from "@/types/express";

export const listAppointmentRequestsController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const filter = req.query as { status?: AppointmentRequestStatus };
    res.json(await listAppointmentRequests(req.auth!, filter));
  } catch (error) {
    next(error);
  }
};

export const proposeChangeController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    res.status(201).json(await proponerCambio(req.auth!, req.body as ProponerCambioInput));
  } catch (error) {
    next(error);
  }
};

export const respondProposalController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { accept } = req.body as { accept: boolean };
    res.json(await responderPropuesta(req.auth!, id, accept));
  } catch (error) {
    next(error);
  }
};

export const createAppointmentRequestController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const created = await createAppointmentRequest(req.auth!, req.body as CreateAppointmentRequestInput);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const rescheduleAppointmentRequestController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const created = await rescheduleAppointmentRequest(
      req.auth!,
      req.body as RescheduleAppointmentRequestInput,
    );
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const acceptAppointmentRequestController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.status(201).json(await acceptAppointmentRequest(req.auth!, id));
  } catch (error) {
    next(error);
  }
};

export const rejectAppointmentRequestController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await rejectAppointmentRequest(req.auth!, id));
  } catch (error) {
    next(error);
  }
};

export const cancelAppointmentRequestController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await cancelAppointmentRequest(req.auth!, id));
  } catch (error) {
    next(error);
  }
};
