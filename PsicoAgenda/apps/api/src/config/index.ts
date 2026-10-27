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
   * Webhook de n8n que entrega los avisos de WhatsApp. Vacío = WhatsApp
   * desconectado: los avisos se quedan PENDIENTES en `notificaciones` y salen
   * solos en cuanto se configure.
   */
  n8nWhatsappWebhookUrl: process.env.N8N_WHATSAPP_WEBHOOK_URL ?? "",
  /** Se envía en la cabecera `X-PsicoAgenda-Secret` para que n8n valide el origen. */
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET ?? "",
} as const;
