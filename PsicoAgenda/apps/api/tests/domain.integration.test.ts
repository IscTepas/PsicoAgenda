import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { estado_cita, rol_usuario, tipo_sesion } from "@/generated/prisma/enums";

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
    expect(result[0]?.one).toBe(1);
  });

  afterAll(async () => {
    if (appointmentId) {
      await prisma.citas.deleteMany({ where: { id: appointmentId } }).catch(() => {});
    }
    if (patientId) {
      await prisma.pacientes.deleteMany({ where: { id: patientId } }).catch(() => {});
    }
    if (psychologistId) {
      await prisma.psicologos.deleteMany({ where: { id: psychologistId } }).catch(() => {});
    }
    if (patientUserId) {
      await prisma.usuarios.deleteMany({ where: { id: patientUserId } }).catch(() => {});
    }
    if (psychologistUserId) {
      await prisma.usuarios.deleteMany({ where: { id: psychologistUserId } }).catch(() => {});
    }
    await disconnectPrisma();
  });

  it("creates a patient user", async () => {
    patientUserId = randomUUID();

    const user = await prisma.usuarios.create({
      data: {
        id: patientUserId,
        correo: `${TEST_TAG}@patient.test`,
        nombre_completo: "Test Patient",
        rol: rol_usuario.PACIENTE,
      },
    });

    expect(user.id).toBe(patientUserId);
    expect(user.correo).toBe(`${TEST_TAG}@patient.test`);
    expect(user.rol).toBe(rol_usuario.PACIENTE);
  });

  it("creates a patient profile", async () => {
    patientId = randomUUID();

    const patient = await prisma.pacientes.create({
      data: {
        id: patientId,
        usuario_id: patientUserId,
      },
    });

    expect(patient.id).toBe(patientId);
    expect(patient.usuario_id).toBe(patientUserId);
  });

  it("creates a psychologist user and profile", async () => {
    psychologistUserId = randomUUID();

    const user = await prisma.usuarios.create({
      data: {
        id: psychologistUserId,
        correo: `${TEST_TAG}@psychologist.test`,
        nombre_completo: "Test Psychologist",
        rol: rol_usuario.PSICOLOGO,
      },
    });
    expect(user.rol).toBe(rol_usuario.PSICOLOGO);

    psychologistId = randomUUID();

    const psychologist = await prisma.psicologos.create({
      data: {
        id: psychologistId,
        usuario_id: psychologistUserId,
        cedula_profesional: `LIC-${TEST_TAG}`,
      },
    });

    expect(psychologist.cedula_profesional).toBe(`LIC-${TEST_TAG}`);
  });

  it("assigns the psychologist to the patient", async () => {
    const updated = await prisma.pacientes.update({
      where: { id: patientId },
      data: { psicologo_id: psychologistId },
    });

    expect(updated.psicologo_id).toBe(psychologistId);
  });

  it("creates an appointment", async () => {
    appointmentId = randomUUID();
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const appointment = await prisma.citas.create({
      data: {
        id: appointmentId,
        psicologo_id: psychologistId,
        paciente_id: patientId,
        inicio: start,
        fin: end,
        tipo_sesion: tipo_sesion.INDIVIDUAL,
      },
    });

    expect(appointment.id).toBe(appointmentId);
    expect(appointment.psicologo_id).toBe(psychologistId);
    expect(appointment.paciente_id).toBe(patientId);
  });

  it("reads the created appointment", async () => {
    const found = await prisma.citas.findUnique({ where: { id: appointmentId } });

    expect(found).not.toBeNull();
    expect(found?.id).toBe(appointmentId);
  });

  it("updates the appointment reason", async () => {
    const updated = await prisma.citas.update({
      where: { id: appointmentId },
      data: { motivo: "Updated reason" },
    });

    expect(updated.motivo).toBe("Updated reason");
  });

  it("cancels the appointment", async () => {
    const cancelled = await prisma.citas.update({
      where: { id: appointmentId },
      data: {
        estado: estado_cita.CANCELADA,
        motivo_cancelacion: "Test cancellation",
        cancelada_por_id: psychologistUserId,
        cancelada_en: new Date(),
      },
    });

    expect(cancelled.estado).toBe(estado_cita.CANCELADA);
    expect(cancelled.motivo_cancelacion).toBe("Test cancellation");
  });
});
