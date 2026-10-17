import type { RequestHandler } from "express";
import {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointment,
  updateAppointmentPayment,
  type CreateAppointmentInput,
  type ListAppointmentsFilter,
  type UpdateAppointmentInput,
} from "@/services/appointment.service";
import type { AuthedRequest } from "@/types/express";

export const listAppointmentsController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    // `validate` ya dejó la query parseada (fechas como Date, uuid validados).
    const filter = req.query as ListAppointmentsFilter;
    res.json(await listAppointments(req.auth!, filter));
  } catch (error) {
    next(error);
  }
};

export const getAppointmentController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getAppointmentById(id, req.auth!));
  } catch (error) {
    next(error);
  }
};

export const createAppointmentController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const created = await createAppointment(req.auth!, req.body as CreateAppointmentInput);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await updateAppointment(req.auth!, id, req.body as UpdateAppointmentInput));
  } catch (error) {
    next(error);
  }
};

export const changeAppointmentStatusController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: Parameters<typeof changeAppointmentStatus>[2] };
    res.json(await changeAppointmentStatus(req.auth!, id, status));
  } catch (error) {
    next(error);
  }
};

export const cancelAppointmentController: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };
    res.json(await cancelAppointment(req.auth!, id, reason));
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentPaymentController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: Parameters<typeof updateAppointmentPayment>[2] };
    res.json(await updateAppointmentPayment(req.auth!, id, status));
  } catch (error) {
    next(error);
  }
};
