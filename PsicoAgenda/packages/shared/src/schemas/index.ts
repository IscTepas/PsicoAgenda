import { z } from "zod";
import { TIMEZONES } from "../constants/index.js";
import {
  AppointmentRequestStatus,
  AppointmentStatus,
  PaymentStatus,
} from "../types/index.js";

/**
 * Correo con usuario, dominio y terminación de al menos dos letras (`.mx`, `.com`).
 * Se recorta y se pasa a minúsculas: `Ana@Correo.com ` y `ana@correo.com` son la
 * misma cuenta.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "El correo es obligatorio")
  .max(254, "El correo es demasiado largo")
  .email("Escribe un correo válido, como nombre@correo.com")
  .regex(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/, "Escribe un correo válido, como nombre@correo.com");

/**
 * Nombre completo: al menos nombre y un apellido, solo letras (con acentos),
 * espacios, apóstrofo, guion y punto.
 */
export const nombreCompletoSchema = z
  .string()
  .trim()
  .min(5, "Escribe tu nombre completo (nombre y apellido)")
  .max(120, "El nombre es demasiado largo")
  .regex(/^[\p{L}][\p{L}'.\- ]*$/u, "El nombre solo puede llevar letras y espacios")
  .refine(
    (valor) => valor.split(/\s+/).filter((parte) => parte.replace(/[^\p{L}]/gu, "").length >= 2).length >= 2,
    "Escribe nombre y apellido",
  );

/** Dirección opcional: si se escribe, debe tener al menos 10 caracteres. */
export const DIRECCION_MIN_CARACTERES = 10;
export const direccionOpcionalSchema = z
  .string()
  .trim()
  .max(300, "La dirección es demasiado larga")
  .refine(
    (valor) => valor === "" || valor.length >= DIRECCION_MIN_CARACTERES,
    `Si escribes una dirección, usa al menos ${DIRECCION_MIN_CARACTERES} caracteres (calle, número y colonia o ciudad)`,
  )
  .optional();

/** Edad mínima para tener expediente: al menos 3 meses de nacido. */
export const EDAD_MINIMA_MESES = 3;

/** `true` si la fecha `YYYY-MM-DD` es de hace al menos `EDAD_MINIMA_MESES` meses. */
export function tieneEdadMinima(fecha: string, hoy: Date = new Date()): boolean {
  const nacimiento = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return false;
  const limite = new Date(hoy.getFullYear(), hoy.getMonth() - EDAD_MINIMA_MESES, hoy.getDate());
  return nacimiento.getTime() <= limite.getTime();
}

/** Consulta pública: si un correo ya tiene cuenta (para avisar en el registro). */
export const correoDisponibleQuerySchema = z.object({ email: emailSchema });

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
  // 30–60: las sesiones de menores duran 30 minutos (getEffectiveDurationMinutes);
  // los adultos siguen eligiendo 45/50/60 desde el formulario. El CHECK de la base
  // ya admite 30–60.
  durationMinutes: z.number().int().min(30).max(60),
  modality: z.enum(["in_person", "virtual"]),
  reason: z.string().optional(),
  /** Motivos del catálogo (uno o varios); «Otro» exige `reason`. */
  reasonIds: z.array(z.string().uuid()).max(12).optional(),
});

export const updateAppointmentSchema = z.object({
  startTime: z.coerce.date().optional(),
  durationMinutes: z.number().int().min(30).max(60).optional(),
  modality: z.enum(["in_person", "virtual"]).optional(),
  reason: z.string().optional(),
  /** Motivos del catálogo (uno o varios); «Otro» exige `reason`. */
  reasonIds: z.array(z.string().uuid()).max(12).optional(),
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
    })
    .refine((status) => status !== AppointmentStatus.COMPLETED && status !== AppointmentStatus.NO_SHOW, {
      message: "La asistencia se registra al cerrar la sesión, junto con el cobro",
    }),
});

/**
 * Cerrar la sesión: asistencia y cobro en un solo paso. Si asistió se registra el
 * pago (por la tarifa de la cita o el monto ajustado); si no asistió, nunca se cobra.
 */
export const closeAppointmentSchema = z.object({
  attended: z.boolean(),
  amount: z.number().min(0, "El monto no puede ser negativo").max(100_000, "El monto es demasiado alto").optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(1, "El motivo de cancelación es obligatorio"),
});

/**
 * Cobro de una cita: pagada, sin costo (condonada) o de vuelta a pendiente para
 * corregir un error. `amount` ajusta lo que se cobra (descuento, sesión más cara).
 */
/** Corrige el monto cobrado de una sesión ya cerrada (o registra el de una anterior al cierre con cobro). */
export const updateAppointmentPaymentSchema = z.object({
  status: z.literal(PaymentStatus.PAID, { message: "Un cobro registrado solo se corrige, no se deshace" }),
  amount: z.number().min(0, "El monto no puede ser negativo").max(100_000, "El monto es demasiado alto").optional(),
});

/** La psicóloga propone otro horario para una cita; el paciente acepta o rechaza. */
export const proponerCambioSchema = z.object({
  appointmentId: z.string().uuid(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(30).max(60).optional(),
  modality: z.enum(["in_person", "virtual"]).optional(),
});

export const responderPropuestaSchema = z.object({ accept: z.boolean() });

/** Solicitud del paciente: el paciente y el psicólogo salen de la sesión, no del cuerpo. */
export const createAppointmentRequestSchema = z.object({
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(30).max(60),
  modality: z.enum(["in_person", "virtual"]),
  reason: z.string().optional(),
  /** Motivos del catálogo (uno o varios); «Otro» exige `reason`. */
  reasonIds: z.array(z.string().uuid()).max(12).optional(),
  /** Un tutor pide a nombre del menor; sin él, la solicitud es del propio paciente. */
  patientId: z.string().uuid().optional(),
});

/**
 * Reagendamiento: el paciente cancela su cita actual y pide el nuevo horario en
 * una sola operación.
 */
export const rescheduleAppointmentRequestSchema = createAppointmentRequestSchema.extend({
  appointmentId: z.string().uuid(),
  /** Por qué se cambia la fecha; queda como motivo de cancelación de la cita original. */
  changeReason: z.string().trim().min(3).max(200).optional(),
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

const MAX_OCCUPANCY_RANGE_MS = 1000 * 60 * 60 * 24 * 31 * 6;

/**
 * Ocupación para el calendario multimes: un rango acotado evita traer meses de
 * agenda por accidente. `to` es exclusivo en la consulta de la API.
 */
export const appointmentOccupancyQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((value) => value.to.getTime() > value.from.getTime(), {
    message: "El rango de fechas no es válido",
    path: ["to"],
  })
  .refine((value) => value.to.getTime() - value.from.getTime() <= MAX_OCCUPANCY_RANGE_MS, {
    message: "El rango máximo es de 6 meses",
    path: ["to"],
  });

/**
 * Bloqueo de agenda. El cliente calcula los instantes (incluido el día completo,
 * que va de 00:00 local a 00:00 del día siguiente) y el servidor los guarda tal
 * cual; `allDay` solo indica cómo presentarlo.
 */
export const createAgendaBlockSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    allDay: z.boolean().optional().default(false),
    reason: z
      .string()
      .trim()
      .max(100, "El motivo no puede superar los 100 caracteres")
      .optional(),
  })
  .refine((value) => value.endTime.getTime() > value.startTime.getTime(), {
    message: "La fecha de fin debe ser posterior al inicio",
    path: ["endTime"],
  });

/**
 * Rango visible del calendario. Se aceptan `from`/`to` y sus alias
 * `startDate`/`endDate` para no atar a los clientes a un solo vocabulario.
 */
export const agendaBlockListQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    psychologistId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const from = value.from ?? value.startDate;
    const to = value.to ?? value.endDate;

    if (!from || !to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica el rango de fechas (from/to o startDate/endDate)",
        path: ["from"],
      });
      return;
    }

    if (to.getTime() <= from.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El rango de fechas no es válido",
        path: ["to"],
      });
    }
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

/**
 * Teléfono local: exactamente 10 dígitos, con el formato visible `555-123-4567`.
 *
 * Se valida por cantidad de dígitos y no por longitud del texto: el valor que
 * escribe la persona incluye guiones, y contar caracteres dejaría pasar números
 * incompletos como `555-123-456` (9 dígitos, 11 caracteres).
 */
export const telefonoSchema = z
  .string()
  .min(1, "El teléfono es obligatorio")
  .regex(/^[+0-9\s()-]+$/, "Formato de teléfono no válido")
  .refine((valor) => valor.replace(/\D/g, "").length === 10, {
    message: "El teléfono debe tener 10 dígitos",
  });

export const emergencyContactSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: telefonoSchema,
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
/** El token de invitación es opaco (32 bytes en base64url = 43 caracteres). */
export const tokenInvitacionSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invitación inválida");

const registroPacienteBaseSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nombreCompletoSchema,
  phone: telefonoSchema,
  birth_date: z
    .string()
    .min(1, "La fecha de nacimiento es obligatoria")
    .refine((valor) => !Number.isNaN(Date.parse(valor)), "Fecha de nacimiento inválida")
    .refine((valor) => tieneEdadMinima(valor), `La persona debe tener al menos ${EDAD_MINIMA_MESES} meses de nacida`),
  gender: z.string().trim().min(1, "Selecciona un género"),
  address: direccionOpcionalSchema,
  emergency_contact: emergencyContactSchema,
  guardian: emergencyContactSchema.optional(),
  /** Si viene de una invitación de cita única, la cuenta se queda con ese historial. */
  invitacion: tokenInvitacionSchema.optional(),
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

/** Alta de un motivo del catálogo (solo administración). */
export const createConsultationReasonSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Código: minúsculas, números y guion bajo"),
  label: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(60),
  order: z.number().int().min(0).max(999).optional(),
  isOther: z.boolean().optional(),
  requiresText: z.boolean().optional(),
});

export const updateConsultationReasonSchema = createConsultationReasonSchema
  .omit({ code: true })
  .partial()
  .extend({ active: z.boolean().optional() });

/**
 * Vincular un tutor desde el expediente: por correo se enlaza una cuenta existente;
 * sin correo se registra un contacto (nombre obligatorio).
 */
export const addGuardianSchema = z
  .object({
    email: emailSchema.optional(),
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(20).optional(),
    relationship: z.string().trim().max(40).optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine((data) => data.email || data.name, {
    message: "Indica el correo de la cuenta o el nombre del tutor",
    path: ["name"],
  });

/**
 * Cita única: la psicóloga da de alta a alguien sin cuenta. Nombre y teléfono
 * bastan; el correo es opcional. Si es menor, hacen falta su fecha de
 * nacimiento (precio y duración) y los datos del tutor.
 */
export const citaUnicaPacienteSchema = z
  .object({
    name: nombreCompletoSchema,
    phone: telefonoSchema.optional(),
    email: z.union([emailSchema, z.literal("")]).optional(),
    isMinor: z.boolean().default(false),
    birthDate: z.coerce.date().optional(),
    guardian: z
      .object({
        name: nombreCompletoSchema,
        phone: telefonoSchema,
        relationship: z.string().trim().max(40).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isMinor && !data.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "El teléfono es obligatorio" });
    }
    if (data.isMinor) {
      if (!data.birthDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["birthDate"], message: "La fecha de nacimiento es obligatoria" });
      } else if (!esMenorDeEdad(data.birthDate.toISOString().slice(0, 10))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["birthDate"], message: "La fecha indica que es mayor de edad" });
      }
      if (!data.guardian) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardian"], message: "Los datos del tutor son obligatorios" });
      }
    }
  });

/** Un paciente adulto da de alta a un menor a su cargo (sin cuenta propia). */
export const addTutoredMinorSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre completo").max(120),
  birthDate: z.coerce.date(),
  relationship: z.string().trim().max(40).optional(),
});

export const guardianParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido"),
  tutorId: z.string().uuid("Identificador inválido"),
});

/** Al quitar al principal hay que nombrar a otro o aceptar quedarse sin principal. */
export const removeGuardianQuerySchema = z.object({
  nuevoPrincipalId: z.string().uuid().optional(),
  sinPrincipal: z.enum(["true", "false"]).optional(),
});

export const solicitarRecuperacionSchema = z.object({ email: emailSchema });

/** El token es opaco (32 bytes en base64url = 43 caracteres). */
export const confirmarRecuperacionSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Enlace de recuperación inválido"),
  password: passwordSchema,
});

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
/** Zona horaria admitida por el perfil (la misma lista que ofrece el formulario). */
export const timezoneSchema = z.enum(TIMEZONES, {
  errorMap: () => ({ message: "Zona horaria no válida" }),
});

/**
 * Foto de perfil: data URL de imagen (lo que produce el selector de archivos) o
 * una URL https. El tope de ~5 MB cubre el base64 de una imagen de 3 MB.
 */
export const photoUrlSchema = z
  .string()
  .max(5_000_000, "La imagen es demasiado grande (máximo 3 MB)")
  .refine(
    (valor) =>
      // Cadena vacía = quitar la foto (la API la guarda como NULL).
      valor === "" ||
      /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(valor) ||
      /^https?:\/\/\S+$/.test(valor),
    "La foto debe ser una imagen PNG, JPG o WebP",
  );

const nombrePerfilSchema = z
  .string()
  .trim()
  .min(2, "El nombre es obligatorio")
  .max(120, "El nombre es demasiado largo");

const montoSchema = z
  .number({ message: "Escribe un monto" })
  .int("Usa pesos enteros, sin centavos")
  .min(0, "El monto no puede ser negativo")
  .max(100_000, "El monto es demasiado alto");

/** Tarifas de las citas; mismos límites que el CHECK `ck_psicologos_tarifas`. */
export const pricingRatesSchema = z.object({
  adultRate: montoSchema,
  minorRate: montoSchema,
  sameDaySurchargePercent: z
    .number({ message: "Escribe un porcentaje" })
    .int("Usa un porcentaje entero")
    .min(0, "El recargo no puede ser negativo")
    .max(300, "El recargo máximo es 300%"),
  sameDaySurchargeAmount: montoSchema.nullable(),
  virtualDiscount: montoSchema,
});

/** Primera y última hora de inicio que admite el horario de atención (sesiones de 07:00 a 22:00). */
export const SCHEDULE_FIRST_HOUR = 7;
export const SCHEDULE_LAST_HOUR = 21;

/**
 * Horario semanal completo: cada franja es una hora de un día (1 = lunes … 7 = domingo).
 * Se guarda entero, así que no puede llegar vacío: un horario sin franjas se
 * confundiría con "psicólogo nuevo" y se rellenaría con el horario por defecto.
 */
export const updatePsychologistScheduleSchema = z.object({
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(1).max(7),
        hour: z.number().int().min(SCHEDULE_FIRST_HOUR).max(SCHEDULE_LAST_HOUR),
      }),
    )
    .min(1, "Deja al menos una hora de atención en la semana")
    .max(7 * 24),
});

export const updatePsychologistProfileSchema = z.object({
  name: nombrePerfilSchema.optional(),
  phone: telefonoSchema.optional(),
  timeZone: timezoneSchema.optional(),
  photoUrl: photoUrlSchema.optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  licenseNumber: z
    .string()
    .trim()
    .min(4, "La cédula debe tener al menos 4 caracteres")
    .max(30, "La cédula es demasiado larga")
    .regex(/^[A-Za-z0-9ÁÉÍÓÚÜáéíóúüÑñ.\s-]+$/, "La cédula contiene caracteres no válidos")
    .optional(),
  specialty: z.string().trim().max(120, "La especialidad es demasiado larga").optional(),
  bio: z.string().trim().max(2000, "La biografía es demasiado larga").optional(),
  rates: pricingRatesSchema.optional(),
  /** Vacío quita el enlace. Mismo límite que el CHECK `ck_psicologos_enlace_videollamada`. */
  videoCallUrl: z
    .string()
    .trim()
    .max(300, "El enlace es demasiado largo")
    .refine((v) => v === "" || /^https:\/\/[^\s]+\.[^\s]+/.test(v), "Pega el enlace completo, empieza con https://")
    .optional(),
  /** Carátula del expediente (NOM-004): datos del establecimiento. */
  facilityName: z.string().trim().max(150, "El nombre del consultorio es demasiado largo").optional(),
  facilityType: z.string().trim().min(3, "Escribe el tipo de establecimiento").max(100, "El tipo es demasiado largo").optional(),
  facilityAddress: z.string().trim().max(300, "El domicilio es demasiado largo").optional(),
});

export const updatePatientProfileSchema = z.object({
  name: nombrePerfilSchema.optional(),
  phone: telefonoSchema.optional(),
  timeZone: timezoneSchema.optional(),
  photoUrl: photoUrlSchema.optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  emergencyContactName: z
    .string()
    .trim()
    .min(2, "El nombre del contacto es obligatorio")
    .max(120, "El nombre del contacto es demasiado largo")
    .optional(),
  emergencyContactPhone: telefonoSchema.optional(),
  emergencyContactRelationship: z
    .string()
    .trim()
    .max(60, "El parentesco es demasiado largo")
    .optional(),
});

/**
 * Perfil completo tal como lo envía la pantalla de perfil: lo que no puede quedar
 * vacío es obligatorio (el PATCH de la API sigue siendo parcial, pero rechaza vacíos).
 */
export const perfilPacienteSchema = updatePatientProfileSchema.required({
  name: true,
  phone: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
});

export const perfilPsicologoSchema = updatePsychologistProfileSchema.required({
  name: true,
  phone: true,
  licenseNumber: true,
});

/**
 * Alta/edición de una nota de bitácora desde la interfaz clínica. La proyección
 * `SessionLogEntry` usa `sessionType`/`interventions`/`homework`, que se mapean a
 * columnas existentes de `LogEntry` sin migración.
 */
const textoClinico = (max: number) => z.string().trim().max(max, "El texto es demasiado largo").optional();

/** Apartados del examen del estado mental (NOM-004, exploración). */
export const APARTADOS_EXAMEN_MENTAL = [
  "apariencia",
  "conducta",
  "animo",
  "lenguaje",
  "pensamiento",
  "memoria",
  "orientacion",
  "juicio",
] as const;

export type ApartadoExamenMental = (typeof APARTADOS_EXAMEN_MENTAL)[number];

export const examenMentalSchema = z.object({
  apariencia: textoClinico(1000),
  conducta: textoClinico(1000),
  animo: textoClinico(1000),
  lenguaje: textoClinico(1000),
  pensamiento: textoClinico(1000),
  memoria: textoClinico(1000),
  orientacion: textoClinico(1000),
  juicio: textoClinico(1000),
});

/** Historia clínica y campos del expediente que escribe la psicóloga. Vacío borra el dato. */
export const updateClinicalRecordSchema = z
  .object({
    chiefComplaint: textoClinico(2000),
    currentProblem: textoClinico(5000),
    familyHistory: textoClinico(5000),
    nonPathologicalHistory: textoClinico(5000),
    pathologicalHistory: textoClinico(5000),
    mentalExam: examenMentalSchema.optional(),
    psychometricTests: textoClinico(5000),
    diagnosis: z.string().trim().max(500, "El diagnóstico es demasiado largo").optional(),
    diagnosisCode: z
      .string()
      .trim()
      .max(10, "El código es demasiado largo")
      .regex(/^$|^[A-Z0-9][A-Z0-9.]*$/i, "Código inválido")
      .optional(),
    diagnosisSystem: z.enum(["CIE-10", "CIE-11"]).optional(),
    prognosis: textoClinico(2000),
    treatmentPlan: textoClinico(5000),
    background: z.string().trim().max(5000, "Los antecedentes son demasiado largos").optional(),
    generalObservations: z.string().trim().max(5000, "Las observaciones son demasiado largas").optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "No hay nada que guardar" });

/** Confirmar con la contraseña antes de cerrar (sellar) una nota o la historia clínica. */
export const confirmarConContrasenaSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña"),
});

/** Nota aclaratoria: corrige una nota cerrada sin alterarla; se sella al crearse. */
export const notaAclaratoriaSchema = confirmarConContrasenaSchema.extend({
  text: z.string().trim().min(3, "Escribe la aclaración").max(5000, "La aclaración es demasiado larga"),
});

/** PNG dibujado en pantalla (data URL). */
const FIRMA_PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
/** PDF firmado en base64: 5 MB de archivo como máximo. */
export const PDF_CONSENTIMIENTO_MAX_BYTES = 5 * 1024 * 1024;
const PDF_BASE64_MAX = Math.ceil((PDF_CONSENTIMIENTO_MAX_BYTES * 4) / 3) + 4;

/**
 * Registro del consentimiento informado (NOM-004 10.1): firma en pantalla o PDF
 * firmado, y el aviso de privacidad aceptado.
 */
export const createConsentSchema = z
  .object({
    signedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .refine((v) => new Date(`${v}T00:00:00`) <= new Date(), "La fecha de firma no puede ser futura"),
    document: z.string().trim().min(3, "Escribe qué documento se firmó").max(200, "El nombre es demasiado largo"),
    guardianId: z.string().uuid().optional(),
    signatureImage: z.string().max(400_000, "La firma es demasiado grande").regex(FIRMA_PNG, "Firma inválida").optional(),
    pdfBase64: z.string().max(PDF_BASE64_MAX, "El PDF debe pesar 5 MB o menos").optional(),
    privacyNoticeAccepted: z.literal(true, { errorMap: () => ({ message: "Falta aceptar el aviso de privacidad" }) }),
  })
  .refine((v) => Boolean(v.signatureImage || v.pdfBase64), {
    message: "Firma en pantalla o sube el PDF firmado",
    path: ["signatureImage"],
  });

export const consentParamsSchema = z.object({
  id: z.string().uuid(),
  consentId: z.string().uuid(),
});

export const createLogEntrySchema = z.object({
  /** Evolución (por defecto), interconsulta/referencia o egreso. La aclaratoria tiene su propia ruta. */
  kind: z.enum(["evolution", "referral", "discharge"]).optional(),
  referredTo: z.string().trim().max(200, "El texto es demasiado largo").optional(),
  referralReason: z.string().trim().max(2000, "El texto es demasiado largo").optional(),
  dischargeReason: z.string().trim().max(500, "El texto es demasiado largo").optional(),
  dischargeSummary: z.string().trim().max(5000, "El texto es demasiado largo").optional(),
  appointmentId: z.string().uuid().optional(),
  sessionType: z.string().optional(),
  notes: z.string().min(1, "Las observaciones de la sesión son obligatorias"),
  interventions: z.string().optional(),
  homework: z.string().optional(),
  // Con `id` se conserva la tarea (y si ya se hizo); sin `id` es nueva y se avisa al paciente.
  tasks: z
    .array(z.object({ id: z.string().uuid().optional(), text: z.string().trim().min(1).max(300) }))
    .max(20)
    .optional(),
});

export const taskDoneSchema = z.object({ done: z.boolean() });

export const updateLogEntrySchema = createLogEntrySchema.partial();
