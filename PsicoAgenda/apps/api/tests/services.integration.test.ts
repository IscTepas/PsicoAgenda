import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { AppointmentModality, PaymentStatus, UserRole } from "@psicoagenda/shared";
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { rol_usuario } from "@/generated/prisma/enums";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointmentPayment,
} from "@/services/appointment.service";
import { getPatientById, listPatients } from "@/services/patient.service";
import type { AuthenticatedUser } from "@/utils/jwt";

/**
 * Pruebas de integración contra la base de datos real usando los servicios de la
 * aplicación (no Prisma directamente). El objetivo es detectar fallos que los tests
 * con mocks no pueden cubrir: mapeo de enums, lógica de autorización, transacciones,
 * constraints de la base, etc.
 */
const TEST_TAG = `services-test-${randomUUID()}`;

describe("services integration against real database", () => {
  let psychologistAuth: AuthenticatedUser;
  let psychologistUserId: string;
  let patientUserId: string;
  let psychologistId: string;
  let patientId: string;
  let appointmentId: string;

  beforeAll(async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result[0]?.one).toBe(1);

    psychologistUserId = randomUUID();
    patientUserId = randomUUID();
    psychologistId = randomUUID();
    patientId = randomUUID();

    await prisma.usuarios.create({
      data: {
        id: psychologistUserId,
        correo: `${TEST_TAG}@psychologist.test`,
        nombre_completo: "Test Psychologist",
        rol: rol_usuario.PSICOLOGO,
      },
    });
    await prisma.psicologos.create({
      data: {
        id: psychologistId,
        usuario_id: psychologistUserId,
        cedula_profesional: `LIC-${TEST_TAG}`,
      },
    });

    await prisma.usuarios.create({
      data: {
        id: patientUserId,
        correo: `${TEST_TAG}@patient.test`,
        nombre_completo: "Test Patient",
        rol: rol_usuario.PACIENTE,
      },
    });
    await prisma.pacientes.create({
      data: {
        id: patientId,
        usuario_id: patientUserId,
        psicologo_id: psychologistId,
      },
    });

    psychologistAuth = {
      id: psychologistUserId,
      email: `${TEST_TAG}@psychologist.test`,
      role: UserRole.PSYCHOLOGIST,
    };
  });

  afterAll(async () => {
    if (appointmentId) {
      // El pago condonado sobrevive a la cancelación y la llave es RESTRICT: va primero.
      await prisma.pagos_honorarios.deleteMany({ where: { cita_id: appointmentId } }).catch(() => {});
      await prisma.citas.deleteMany({ where: { id: appointmentId } }).catch(() => {});
    }
    await prisma.pacientes.deleteMany({ where: { id: patientId } }).catch(() => {});
    await prisma.psicologos.deleteMany({ where: { id: psychologistId } }).catch(() => {});
    await prisma.usuarios.deleteMany({ where: { id: patientUserId } }).catch(() => {});
    await prisma.usuarios.deleteMany({ where: { id: psychologistUserId } }).catch(() => {});
    await disconnectPrisma();
  });

  it("creates an appointment through the service", async () => {
    const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);

    const appointment = await createAppointment(psychologistAuth, {
      patientId,
      startTime: start,
      durationMinutes: 60,
      modality: AppointmentModality.IN_PERSON,
    });

    appointmentId = appointment.id;
    expect(appointment.psychologistId).toBe(psychologistId);
    expect(appointment.patientId).toBe(patientId);
    // La agenda el profesional: nace confirmada.
    expect(appointment.status).toBe("confirmed");
    // Adulto, presencial y a 48h: tarifa base sin recargos.
    expect(appointment.price).toBe(800);
    // El honorario nace con la cita, pendiente de cobro y por el mismo importe.
    expect(appointment.payment).toMatchObject({
      appointmentId: appointment.id,
      amount: "800",
      status: PaymentStatus.PENDING,
    });
  });

  it("reads the appointment through the service", async () => {
    const found = await getAppointmentById(appointmentId, psychologistAuth);

    expect(found.id).toBe(appointmentId);
  });

  it("marks the honorarium as paid and then as waived", async () => {
    const paid = await updateAppointmentPayment(psychologistAuth, appointmentId, PaymentStatus.PAID);

    expect(paid.payment?.status).toBe(PaymentStatus.PAID);
    // El CHECK `ck_pagos_fecha` exige marca de cobro cuando el estado es PAGADO.
    expect(paid.payment?.paidAt).toBeInstanceOf(Date);

    const waived = await updateAppointmentPayment(
      psychologistAuth,
      appointmentId,
      PaymentStatus.WAIVED,
    );

    expect(waived.payment?.status).toBe(PaymentStatus.WAIVED);
    expect(waived.payment?.paidAt).toBeUndefined();
  });

  it("lists appointments for the psychologist", async () => {
    const appointments = await listAppointments(psychologistAuth, {});

    expect(appointments.some((a) => a.id === appointmentId)).toBe(true);
  });

  it("lists patients visible to a psychologist", async () => {
    const patients = await listPatients(psychologistAuth);

    expect(patients.some((p) => p.id === patientId)).toBe(true);
  });

  it("reads a patient through the service", async () => {
    const found = await getPatientById(patientId, psychologistAuth);

    expect(found.id).toBe(patientId);
    expect(found.email).toBe(`${TEST_TAG}@patient.test`);
  });

  it("prevents a patient from reading another patient's appointment", async () => {
    const otherPatientUserId = randomUUID();
    const otherPatientId = randomUUID();

    await prisma.usuarios.create({
      data: {
        id: otherPatientUserId,
        correo: `${TEST_TAG}-other@patient.test`,
        nombre_completo: "Other Test Patient",
        rol: rol_usuario.PACIENTE,
      },
    });
    await prisma.pacientes.create({
      data: {
        id: otherPatientId,
        usuario_id: otherPatientUserId,
      },
    });

    const otherPatientAuth: AuthenticatedUser = {
      id: otherPatientUserId,
      email: `${TEST_TAG}-other@patient.test`,
      role: UserRole.PATIENT,
    };

    await expect(getAppointmentById(appointmentId, otherPatientAuth)).rejects.toMatchObject({
      statusCode: 403,
    });

    await prisma.pacientes.deleteMany({ where: { id: otherPatientId } }).catch(() => {});
    await prisma.usuarios.deleteMany({ where: { id: otherPatientUserId } }).catch(() => {});
  });

  it("cancels the appointment and keeps an already waived honorarium", async () => {
    const cancelled = await cancelAppointment(psychologistAuth, appointmentId, "Test cancellation");

    expect(cancelled.status).toBe("cancelled");
    // El honorario ya estaba condonado (paso anterior): es constancia y se conserva.
    expect(cancelled.payment?.status).toBe(PaymentStatus.WAIVED);
  });
});
