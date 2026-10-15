import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { UserRole } from "@psicoagenda/shared";
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { UserRole as SchemaRole } from "@/generated/prisma/enums";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  listAppointments,
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
    expect(result[0].one).toBe(1);

    psychologistUserId = randomUUID();
    patientUserId = randomUUID();
    psychologistId = randomUUID();
    patientId = randomUUID();

    await prisma.user.create({
      data: {
        id: psychologistUserId,
        email: `${TEST_TAG}@psychologist.test`,
        name: "Test Psychologist",
        role: SchemaRole.PSYCHOLOGIST,
      },
    });
    await prisma.psychologist.create({
      data: {
        id: psychologistId,
        userId: psychologistUserId,
        licenseNumber: `LIC-${TEST_TAG}`,
      },
    });

    await prisma.user.create({
      data: {
        id: patientUserId,
        email: `${TEST_TAG}@patient.test`,
        name: "Test Patient",
        role: SchemaRole.PATIENT,
      },
    });
    await prisma.patient.create({
      data: {
        id: patientId,
        userId: patientUserId,
        psychologistId,
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
      await prisma.appointment.deleteMany({ where: { id: appointmentId } }).catch(() => {});
    }
    await prisma.patient.deleteMany({ where: { id: patientId } }).catch(() => {});
    await prisma.psychologist.deleteMany({ where: { id: psychologistId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: patientUserId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: psychologistUserId } }).catch(() => {});
    await disconnectPrisma();
  });

  it("creates an appointment through the service", async () => {
    const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);

    const appointment = await createAppointment(psychologistAuth, {
      patientId,
      startTime: start,
      durationMinutes: 60,
      modality: "in_person",
    });

    appointmentId = appointment.id;
    expect(appointment.psychologistId).toBe(psychologistId);
    expect(appointment.patientId).toBe(patientId);
    expect(appointment.status).toBe("confirmed");
  });

  it("reads the appointment through the service", async () => {
    const found = await getAppointmentById(appointmentId, psychologistAuth);

    expect(found.id).toBe(appointmentId);
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

    await prisma.user.create({
      data: {
        id: otherPatientUserId,
        email: `${TEST_TAG}-other@patient.test`,
        name: "Other Test Patient",
        role: SchemaRole.PATIENT,
      },
    });
    await prisma.patient.create({
      data: {
        id: otherPatientId,
        userId: otherPatientUserId,
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

    await prisma.patient.deleteMany({ where: { id: otherPatientId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: otherPatientUserId } }).catch(() => {});
  });

  it("cancels the appointment through the service", async () => {
    const cancelled = await cancelAppointment(psychologistAuth, appointmentId, "Test cancellation");

    expect(cancelled.status).toBe("cancelled");
  });
});
