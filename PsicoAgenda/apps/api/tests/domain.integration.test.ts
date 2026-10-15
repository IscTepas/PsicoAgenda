import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, disconnectPrisma } from "@/lib/prisma";
import {
  AppointmentStatus,
  SessionType,
  UserRole,
} from "@/generated/prisma/enums";

/**
 * Pruebas de integración de dominio reales. Intentan el flujo completo de negocio
 * (usuario -> perfil -> cita) contra la base de datos configurada, sin mocks.
 */
const TEST_TAG = `domain-test-${randomUUID()}`;

describe("domain CRUD integration", () => {
  let patientUserId: string;
  let psychologistUserId: string;
  let patientId: string;
  let psychologistId: string;
  let appointmentId: string;

  beforeAll(async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result[0].one).toBe(1);
  });

  afterAll(async () => {
    if (appointmentId) {
      await prisma.appointment.deleteMany({ where: { id: appointmentId } }).catch(() => {});
    }
    if (patientId) {
      await prisma.patient.deleteMany({ where: { id: patientId } }).catch(() => {});
    }
    if (psychologistId) {
      await prisma.psychologist.deleteMany({ where: { id: psychologistId } }).catch(() => {});
    }
    if (patientUserId) {
      await prisma.user.deleteMany({ where: { id: patientUserId } }).catch(() => {});
    }
    if (psychologistUserId) {
      await prisma.user.deleteMany({ where: { id: psychologistUserId } }).catch(() => {});
    }
    await disconnectPrisma();
  });

  it("creates a patient user", async () => {
    patientUserId = randomUUID();

    const user = await prisma.user.create({
      data: {
        id: patientUserId,
        email: `${TEST_TAG}@patient.test`,
        name: "Test Patient",
        role: UserRole.PATIENT,
      },
    });

    expect(user.id).toBe(patientUserId);
    expect(user.email).toBe(`${TEST_TAG}@patient.test`);
    expect(user.role).toBe(UserRole.PATIENT);
  });

  it("creates a patient profile", async () => {
    patientId = randomUUID();

    const patient = await prisma.patient.create({
      data: {
        id: patientId,
        userId: patientUserId,
      },
    });

    expect(patient.id).toBe(patientId);
    expect(patient.userId).toBe(patientUserId);
  });

  it("creates a psychologist user and profile", async () => {
    psychologistUserId = randomUUID();

    const user = await prisma.user.create({
      data: {
        id: psychologistUserId,
        email: `${TEST_TAG}@psychologist.test`,
        name: "Test Psychologist",
        role: UserRole.PSYCHOLOGIST,
      },
    });
    expect(user.role).toBe(UserRole.PSYCHOLOGIST);

    psychologistId = randomUUID();

    const psychologist = await prisma.psychologist.create({
      data: {
        id: psychologistId,
        userId: psychologistUserId,
        licenseNumber: `LIC-${TEST_TAG}`,
      },
    });

    expect(psychologist.licenseNumber).toBe(`LIC-${TEST_TAG}`);
  });

  it("assigns the psychologist to the patient", async () => {
    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: { psychologistId },
    });

    expect(updated.psychologistId).toBe(psychologistId);
  });

  it("creates an appointment", async () => {
    appointmentId = randomUUID();
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const appointment = await prisma.appointment.create({
      data: {
        id: appointmentId,
        psychologistId,
        patientId,
        start,
        end,
        sessionType: SessionType.INDIVIDUAL,
      },
    });

    expect(appointment.id).toBe(appointmentId);
    expect(appointment.psychologistId).toBe(psychologistId);
    expect(appointment.patientId).toBe(patientId);
  });

  it("reads the created appointment", async () => {
    const found = await prisma.appointment.findUnique({ where: { id: appointmentId } });

    expect(found).not.toBeNull();
    expect(found?.id).toBe(appointmentId);
  });

  it("updates the appointment reason", async () => {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { reason: "Updated reason" },
    });

    expect(updated.reason).toBe("Updated reason");
  });

  it("cancels the appointment", async () => {
    const cancelled = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelReason: "Test cancellation",
        cancelledById: psychologistUserId,
        cancelledAt: new Date(),
      },
    });

    expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);
    expect(cancelled.cancelReason).toBe("Test cancellation");
  });
});
