import type { RequestHandler } from "express";
import type { AppointmentStatus } from "@psicoagenda/shared";
import {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointment,
} from "@/services/appointment.service";
import type { AuthedRequest } from "@/types/express";
import type { AppointmentFilter } from "@/services/appointment.service";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/types/appointment";

export const listAppointmentsController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    // `validate` ya dejó la query parseada (fechas como Date, uuid validados).
    const filter = req.query as unknown as AppointmentFilter;
    res.json(await listAppointments(req.auth!, filter));
  } catch (error) {
    next(error);
  }
};

export const getAppointmentController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    const { id } = req.params as { id: string };
    res.json(await getAppointmentById(id, req.auth!));
  } catch (error) {
    next(error);
  }
};

export const createAppointmentController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    const body = req.body as CreateAppointmentInput;
    const created = await createAppointment(req.auth!, body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateAppointmentInput;
    res.json(await updateAppointment(req.auth!, id, body));
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
    const { status } = req.body as { status: AppointmentStatus };
    res.json(await changeAppointmentStatus(req.auth!, id, status));
  } catch (error) {
    next(error);
  }
};

export const cancelAppointmentController: RequestHandler = async (
  req: AuthedRequest,
  res,
  next,
) => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };
    res.json(await cancelAppointment(req.auth!, id, reason));
  } catch (error) {
    next(error);
  }
};
