import dotenv from "dotenv";

// `import.meta.dirname` funciona porque apps/api es ESM ("type": "module").
// dist/ replica la profundidad de src/, así que la ruta relativa es estable en dev y en build.
// `quiet` evita el aviso "injected env (…) from .env" en cada arranque.
dotenv.config({ path: new URL("../../.env", import.meta.url), quiet: true });

const requiredInProduction = (name: string, value: string | undefined): string => {
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Falta la variable de entorno obligatoria ${name}`);
  }
  return "";
};

const toPort = (value: string | undefined, fallback: number): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Credenciales de la API de WhatsApp Business (Cloud API).
 */
const whatsappPhoneId = (process.env.WHATSAPP_PHONE_ID ?? "").trim();
const whatsappAccessToken = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
const whatsappTemplateLanguage = (process.env.WHATSAPP_TEMPLATE_LANG ?? "").trim() || "en_US";
const whatsappApiVersion = ((process.env.WHATSAPP_API_VERSION ?? "").trim() || "v25.0").replace(
  /^\/+|\/+$/g,
  "",
);

/**
 * Plantillas de WhatsApp.
 *
 * Si se define `WHATSAPP_TEMPLATE_NAME`, todas las notificaciones usan esa
 * plantilla única (útil para pruebas con plantillas sin parámetros).
 * Si no, se usa un mapeo por tipo de aviso:
 *   - avisos al profesional (solicitudes/cancelaciones del paciente)
 *   - avisos al paciente (confirmaciones/agendaciones/modificaciones)
 *   - cancelaciones/rechazos al paciente
 *   - recordatorios
 *
 * Las plantillas por tipo esperan parámetros de cuerpo posicionales; la lista
 * de campos que se inyectan se define con `WHATSAPP_TEMPLATE_BODY` / `*_BODY_*`
 * (por defecto {{1}} nombre, {{2}} mensaje, {{3}} fecha/hora). La plantilla
 * única puede configurarse con `WHATSAPP_TEMPLATE_PARAMS`.
 */
const whatsappTemplateName = (process.env.WHATSAPP_TEMPLATE_NAME ?? "").trim();
const whatsappTemplatePsychologist =
  (process.env.WHATSAPP_TEMPLATE_PSYCHOLOGIST ?? "").trim() || "psicoagenda_aviso_profesional";
const whatsappTemplatePatientNotice =
  (process.env.WHATSAPP_TEMPLATE_PATIENT_NOTICE ?? "").trim() || "psicoagenda_aviso_paciente";
const whatsappTemplatePatientCancellation =
  (process.env.WHATSAPP_TEMPLATE_PATIENT_CANCELLATION ?? "").trim() ||
  "psicoagenda_cancelacion_paciente";
const whatsappTemplateReminder =
  (process.env.WHATSAPP_TEMPLATE_REMINDER ?? "").trim() || "psicoagenda_recordatorio";

const toTemplateParams = (value: string | undefined, templateName: string): number => {
  if (value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  if (templateName === "jaspers_market_plain_text_v1") return 0;
  return 3;
};
const whatsappTemplateParams = toTemplateParams(
  process.env.WHATSAPP_TEMPLATE_PARAMS,
  whatsappTemplateName || whatsappTemplatePsychologist,
);

/**
 * Parámetros de cuerpo de cada plantilla: lista ordenada de campos, separados
 * por comas, que se inyectan como {{1}}, {{2}}, {{3}}… en el cuerpo de la
 * plantilla aprobada. Campos disponibles:
 *
 *   nombre     → nombre completo del destinatario
 *   asunto     → asunto del aviso
 *   mensaje    → texto completo del aviso
 *   fecha      → fecha de la cita (localizada)
 *   hora       → hora de la cita (localizada)
 *   fecha_hora → fecha y hora de la cita (localizadas)
 *   modalidad  → «videollamada» o «presencial»
 *   empresa    → nombre del consultorio (PsicoAgenda)
 *   tiempohasta → «mañana», «en N horas» u «hoy» (para recordatorios)
 *
 * Si no se define, se usa «nombre,mensaje,fecha_hora» (el comportamiento
 * anterior). Con `WHATSAPP_TEMPLATE_PARAMS=0` la plantilla es de texto plano y
 * esta lista se ignora (no se envían parámetros de cuerpo). Cada tipo de aviso
 * puede declarar su propia lista con `WHATSAPP_TEMPLATE_BODY_*`; la genérica
 * (`WHATSAPP_TEMPLATE_BODY`) es el valor por defecto de todas.
 */
const CAMPOS_CUERPO_POR_DEFECTO = ["nombre", "mensaje", "fecha_hora"];

const parseCamposCuerpo = (value: string | undefined): string[] | null => {
  const campos = (value ?? "")
    .split(",")
    .map((campo) => campo.trim().toLowerCase())
    .filter(Boolean);
  return campos.length > 0 ? campos : null;
};

const whatsappTemplateBody =
  parseCamposCuerpo(process.env.WHATSAPP_TEMPLATE_BODY) ?? CAMPOS_CUERPO_POR_DEFECTO;
const whatsappTemplateBodyPsychologist =
  parseCamposCuerpo(process.env.WHATSAPP_TEMPLATE_BODY_PSYCHOLOGIST) ?? whatsappTemplateBody;
const whatsappTemplateBodyPatientNotice =
  parseCamposCuerpo(process.env.WHATSAPP_TEMPLATE_BODY_PATIENT_NOTICE) ?? whatsappTemplateBody;
const whatsappTemplateBodyPatientCancellation =
  parseCamposCuerpo(process.env.WHATSAPP_TEMPLATE_BODY_PATIENT_CANCELLATION) ?? whatsappTemplateBody;
const whatsappTemplateBodyReminder =
  parseCamposCuerpo(process.env.WHATSAPP_TEMPLATE_BODY_REMINDER) ?? whatsappTemplateBody;

/**
 * Idioma de cada plantilla. Meta registra cada plantilla con un idioma concreto
 * y rechaza el envío si el `language.code` no coincide. La genérica
 * (`WHATSAPP_TEMPLATE_LANG`) vale para todas; cada tipo de aviso puede declarar
 * el suyo con `WHATSAPP_TEMPLATE_LANG_*` (p. ej. `WHATSAPP_TEMPLATE_LANG_REMINDER`).
 */
const whatsappTemplateLanguagePsychologist =
  (process.env.WHATSAPP_TEMPLATE_LANG_PSYCHOLOGIST ?? "").trim() || whatsappTemplateLanguage;
const whatsappTemplateLanguagePatientNotice =
  (process.env.WHATSAPP_TEMPLATE_LANG_PATIENT_NOTICE ?? "").trim() || whatsappTemplateLanguage;
const whatsappTemplateLanguagePatientCancellation =
  (process.env.WHATSAPP_TEMPLATE_LANG_PATIENT_CANCELLATION ?? "").trim() || whatsappTemplateLanguage;
const whatsappTemplateLanguageReminder =
  (process.env.WHATSAPP_TEMPLATE_LANG_REMINDER ?? "").trim() || whatsappTemplateLanguage;

/**
 * Formato de los parámetros de cada plantilla: NAMED (placeholders con nombre,
 * `{{nombre}}`, `{{fecha}}`…) o POSITIONAL (`{{1}}`, `{{2}}`…). Meta exige, para
 * las NAMED, que cada parámetro lleve su `parameter_name`. La genérica
 * (`WHATSAPP_TEMPLATE_NAMED`) vale para todas; cada tipo de aviso puede declarar
 * el suyo con `WHATSAPP_TEMPLATE_NAMED_*`.
 */
const parseBool = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
};

const whatsappTemplateNamed = parseBool(process.env.WHATSAPP_TEMPLATE_NAMED) ?? false;
const whatsappTemplateNamedPsychologist =
  parseBool(process.env.WHATSAPP_TEMPLATE_NAMED_PSYCHOLOGIST) ?? whatsappTemplateNamed;
const whatsappTemplateNamedPatientNotice =
  parseBool(process.env.WHATSAPP_TEMPLATE_NAMED_PATIENT_NOTICE) ?? whatsappTemplateNamed;
const whatsappTemplateNamedPatientCancellation =
  parseBool(process.env.WHATSAPP_TEMPLATE_NAMED_PATIENT_CANCELLATION) ?? whatsappTemplateNamed;
const whatsappTemplateNamedReminder =
  parseBool(process.env.WHATSAPP_TEMPLATE_NAMED_REMINDER) ?? whatsappTemplateNamed;

/**
 * Variables que el flujo de registro necesita para funcionar a full: en
 * producción su ausencia es un error de despliegue (arranque fallido), en
 * desarrollo la API sigue encendida con un aviso y el mailer degrada (escribe
 * el código en la consola de la API en lugar de enviarlo).
 */
const requiredForRegistro = (name: string, value: string | undefined): string => {
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Falta la variable de entorno obligatoria ${name}`);
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[config] Falta ${name}: el registro de usuarios quedará en modo degradado (el código se escribirá en la consola en lugar de enviarse por correo).`,
    );
  }
  return "";
};

// Vercel pone NODE_ENV=production también en los previews: sin este candado, una
// DATABASE_URL definida "para todos los entornos" haría que un preview escriba en la
// base real. `ENTORNO_BD=preview` se define solo junto a las variables del proyecto aislado.
if (process.env.VERCEL_ENV === "preview" && process.env.ENTORNO_BD !== "preview") {
  throw new Error(
    "Preview sin base aislada: define ENTORNO_BD=preview y las variables del proyecto de vista previa (ver README, «Entornos»).",
  );
}

export const config = {
  port: toPort(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: requiredInProduction("DATABASE_URL", process.env.DATABASE_URL),
  /** URL del proyecto Supabase. De ahí se deriva el JWKS y el `issuer` de los tokens. */
  supabaseUrl: requiredInProduction("SUPABASE_URL", process.env.SUPABASE_URL).replace(/\/+$/, ""),
  /**
   * Tamaño máximo del pool de conexiones. `pg` abre 10 por defecto y Supavisor
   * tiene un "Pool Size" acotado por combinación base-de-datos+rol: con más de
   * una instancia de la API el límite se agota con facilidad.
   *
   * En serverless (Vercel) cada instancia abre su propio pool: usar 1 y apuntar
   * `DATABASE_URL` al puerto 6543 (modo transacción), no al 5432 (sesión).
   */
  databasePoolMax: toPort(process.env.DATABASE_POOL_MAX, 5),
  /**
   * Orígenes permitidos por CORS, separados por comas. Cada entrada admite `*`
   * como comodín (`https://psicoagenda-web-*.vercel.app`), de modo que los
   * preview deployments pueden autenticarse sin abrir la API a cualquier origen.
   */
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean),
  /**
   * Secreto del cron externo que dispara el despacho de notificaciones.
   *
   * No entra en `requiredInProduction` a propósito: si faltara, tumbaríamos el
   * arranque completo de la API por una tarea programada. En su lugar el
   * endpoint falla cerrado (503) cuando el secreto no está configurado.
   */
  cronSecret: process.env.CRON_SECRET ?? "",

  /**
   * URL pública del frontend, para los enlaces que salen por correo. Sin
   * `WEB_URL` se toma el primer origen de CORS sin comodín (el dominio real).
   */
  webUrl: (
    process.env.WEB_URL ??
    (process.env.CORS_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((origen) => origen.trim())
      .find((origen) => origen && !origen.includes("*")) ??
    "http://localhost:3000"
  ).replace(/\/+$/, ""),

  /**
   * Mailer de registro (SMTP de Gmail con contraseña de aplicación). La API es
   * la única que envía correos: el SMTP por defecto de Supabase solo entrega a
   * los correos del equipo del proyecto y con un límite de 2 por hora.
   */
  gmailUser: requiredForRegistro("GMAIL_USER", process.env.GMAIL_USER),
  gmailAppPassword: requiredForRegistro("GMAIL_APP_PASSWORD", process.env.GMAIL_APP_PASSWORD),

  /**
   * Clave de servicio de Supabase Auth: solo se usa en el servidor, después de
   * verificar el código, para crear la cuenta ya confirmada. Nunca viaja al
   * navegador (apps/web no debe importarla).
   */
  supabaseServiceRoleKey: requiredForRegistro(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),

  /**
   * API de WhatsApp Business (Cloud API). Si faltan el ID del número emisor o
   * el token de acceso, WhatsApp queda desconectado: los avisos de ese canal
   * se conservan PENDIENTES y no bloquean sistema ni correo.
   */
  whatsappPhoneId,
  whatsappAccessToken,
  whatsappEnabled: Boolean(whatsappPhoneId && whatsappAccessToken),
  /** Plantilla única (opcional). Si está definida, se usa para todo. */
  whatsappTemplateName,
  whatsappTemplatePsychologist,
  whatsappTemplatePatientNotice,
  whatsappTemplatePatientCancellation,
  whatsappTemplateReminder,
  whatsappTemplateLanguage,
  whatsappApiVersion,
  /** Número de parámetros de cuerpo que espera la plantilla configurada (0 = texto plano). */
  whatsappTemplateParams,
  /** Lista de campos del cuerpo por plantilla; ver `parseCamposCuerpo`. */
  whatsappTemplateBody,
  whatsappTemplateBodyPsychologist,
  whatsappTemplateBodyPatientNotice,
  whatsappTemplateBodyPatientCancellation,
  whatsappTemplateBodyReminder,
  /** Idioma por plantilla; ver `whatsappTemplateLanguage*`. */
  whatsappTemplateLanguagePsychologist,
  whatsappTemplateLanguagePatientNotice,
  whatsappTemplateLanguagePatientCancellation,
  whatsappTemplateLanguageReminder,
  /** Formato de parámetros (NAMED/POSITIONAL) por plantilla. */
  whatsappTemplateNamed,
  whatsappTemplateNamedPsychologist,
  whatsappTemplateNamedPatientNotice,
  whatsappTemplateNamedPatientCancellation,
  whatsappTemplateNamedReminder,
  /**
   * Token que Meta exige al suscribir el webhook de entregas de WhatsApp.
   * Si falta, el endpoint GET de verificación responde 403.
   */
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
} as const;
