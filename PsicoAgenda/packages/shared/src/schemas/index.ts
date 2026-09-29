import { z } from "zod";
import { AppointmentStatus } from "../types";

export const emailSchema = z.string().email("Correo electrónico inválido");

// El alta real la ejecuta el proveedor de identidad; este esquema solo valida el
// formulario antes de enviar las credenciales. Los esquemas de inicio de sesión y de
// alta desaparecieron con el acceso de demostración.
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número");

export const createAppointmentSchema = z.object({
  psychologistId: z.string().uuid(),
  patientId: z.string().uuid(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().min(45).max(60),
  modality: z.enum(["in_person", "virtual"]),
  reason: z.string().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: z.string().min(10, "Teléfono inválido"),
  relationship: z.string().optional(),
});

export const logEntrySchema = z.object({
  clinicalRecordId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  sessionNotes: z.string().min(1, "Las notas de sesión son obligatorias"),
});
