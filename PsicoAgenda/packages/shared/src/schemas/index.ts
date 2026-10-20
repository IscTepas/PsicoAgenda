import { z } from "zod";
import { AppointmentRequestStatus, AppointmentStatus, PaymentStatus } from "../types";

export const emailSchema = z.string().email("Correo electrónico inválido");

export const idParamSchema = z.object({
  id: z.string().uuid("Identificador inválido"),
});

// El alta real la ejecuta el proveedor de identidad; este esquema solo valida el
// formulario antes de enviar las credenciales. Los esquemas de inicio de sesión y de
// alta desaparecieron con el acceso de demostración.
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número");

/**
 * El psicólogo no lo elige el cliente en el flujo normal: la API lo resuelve a
 * partir de la sesión (psicólogo autenticado) o del paciente. Solo se acepta si
 * viene, para el caso administrativo.
 */
export const createAppointmentSchema = z.object({
  psychologistId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(45).max(60),
  modality: z.enum(["in_person", "virtual"]),
  reason: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  startTime: z.coerce.date().optional(),
  durationMinutes: z.number().int().min(45).max(60).optional(),
  modality: z.enum(["in_person", "virtual"]).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Cambio de estado administrativo. La cancelación NO viaja por aquí: exige un
 * motivo y una marca de tiempo (CHECK `ck_citas_cancelacion`), así que tiene su
 * propio esquema y endpoint.
 */
export const updateAppointmentStatusSchema = z.object({
  status: z
    .nativeEnum(AppointmentStatus)
    .refine((status) => status !== AppointmentStatus.CANCELLED, {
      message: "Para cancelar una cita usa el endpoint de cancelación con motivo",
    }),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(1, "El motivo de cancelación es obligatorio"),
});

/**
 * Estado de cobro de una cita. Solo se puede marcar como cobrada o condonada:
 * el estado `pending` es el inicial y no se vuelve a él por API.
 */
export const updateAppointmentPaymentSchema = z.object({
  status: z
    .nativeEnum(PaymentStatus)
    .refine((status) => status !== PaymentStatus.PENDING, {
      message: "El estado de pago debe ser paid o waived",
    }),
});

/** Solicitud del paciente: el paciente y el psicólogo salen de la sesión, no del cuerpo. */
export const createAppointmentRequestSchema = z.object({
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(45).max(60),
  modality: z.enum(["in_person", "virtual"]),
  reason: z.string().optional(),
});

export const appointmentRequestListQuerySchema = z.object({
  status: z.nativeEnum(AppointmentRequestStatus).optional(),
});

export const appointmentListQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  patientId: z.string().uuid().optional(),
  psychologistId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  page: z.coerce.number().int().min(1).optional(),
});

/**
 * Listado de pacientes. Express entrega la query como strings, así que todo va
 * con `z.coerce.number()` (sin defaults: el servicio aplica `limit=100` y
 * deriva `offset` de `page` cuando `offset` no viene).
 */
export const patientListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: z.string().min(10, "Teléfono inválido"),
  relationship: z.string().optional(),
});

/** Edad a partir de una fecha `YYYY-MM-DD`; `true` si la persona es menor de 18. */
export function esMenorDeEdad(fecha: string): boolean {
  const nacimiento = new Date(fecha);
  if (Number.isNaN(nacimiento.getTime())) return false;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad >= 0 && edad < 18;
}

/**
 * Payload del registro de paciente en dos pasos. La API lo revalida en
 * `pre-registro` y otra vez en `verificar-codigo` antes de crear la cuenta
 * (el cliente nunca es fuente de verdad) y viaja como `user_metadata` para que
 * `handle_new_user` arme el expediente. El tutor es obligatorio cuando la
 * fecha de nacimiento resulta en menor de edad: la minoría se deriva en el
 * servidor, no se confía en el campo del cliente.
 */
const registroPacienteBaseSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres"),
  phone: z
    .string()
    .min(10, "El teléfono debe contener al menos 10 dígitos")
    .regex(/^[+0-9\s-()]+$/, "Formato de teléfono no válido"),
  birth_date: z
    .string()
    .min(1, "La fecha de nacimiento es obligatoria")
    .refine((valor) => !Number.isNaN(Date.parse(valor)), "Fecha de nacimiento inválida"),
  gender: z.string().optional(),
  address: z.string().optional(),
  emergency_contact: emergencyContactSchema,
  guardian: emergencyContactSchema.optional(),
});

interface DatosRegistro {
  birth_date: string;
  guardian?: { name: string; phone: string; relationship?: string };
}

/** El tutor es obligatorio cuando la fecha resulta en menor de 18: se deriva
 * en el servidor, no se confía en el campo del cliente. */
const exigirTutorSiMenor = (data: DatosRegistro, ctx: z.RefinementCtx): void => {
  if (esMenorDeEdad(data.birth_date) && !data.guardian) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Los datos del tutor legal son obligatorios para menores de edad",
      path: ["guardian"],
    });
  }
};

export const registroPacienteSchema = registroPacienteBaseSchema.superRefine(exigirTutorSiMenor);

/**
 * Payload de `verificar-codigo`: el mismo del pre-registro más el código de 6
 * dígitos. La API vuelve a validar TODO entero antes de crear la cuenta, así
 * que un payload alterado entre pasos no pasa.
 */
export const verificarCodigoRegistroSchema = registroPacienteBaseSchema
  .extend({ codigo: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos") })
  .superRefine(exigirTutorSiMenor);

export type RegistroPaciente = z.infer<typeof registroPacienteSchema>;
export type VerificarCodigoRegistro = z.infer<typeof verificarCodigoRegistroSchema>;

export const logEntrySchema = z.object({
  clinicalRecordId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  sessionNotes: z.string().min(1, "Las notas de sesión son obligatorias"),
});

/**
 * Actualización del perfil del psicólogo. Los campos vacíos se normalizan a `null`
 * en el servicio (una cédula vacía no es una cédula).
 */
export const updatePsychologistProfileSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").optional(),
  phone: z.string().optional(),
  timeZone: z.string().min(1, "La zona horaria es obligatoria").optional(),
  photoUrl: z.string().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  licenseNumber: z.string().min(1, "La cédula es obligatoria").optional(),
  specialty: z.string().optional(),
  bio: z.string().optional(),
});

export const updatePatientProfileSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").optional(),
  phone: z.string().optional(),
  timeZone: z.string().min(1, "La zona horaria es obligatoria").optional(),
  photoUrl: z.string().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
});

/**
 * Alta/edición de una nota de bitácora desde la interfaz clínica. La proyección
 * `SessionLogEntry` usa `sessionType`/`interventions`/`homework`, que se mapean a
 * columnas existentes de `LogEntry` sin migración.
 */
export const createLogEntrySchema = z.object({
  appointmentId: z.string().uuid().optional(),
  sessionType: z.string().optional(),
  notes: z.string().min(1, "Las observaciones de la sesión son obligatorias"),
  interventions: z.string().optional(),
  homework: z.string().optional(),
});

export const updateLogEntrySchema = createLogEntrySchema.partial();
