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
   * Tamaño máximo del pool de conexiones. `pg` abre 10 por defecto y Supavisor en
   * modo sesión tiene un "Pool Size" acotado por combinación base-de-datos+rol:
   * con más de una instancia de la API el límite se agota con facilidad.
   */
  databasePoolMax: toPort(process.env.DATABASE_POOL_MAX, 5),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",

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
} as const;
