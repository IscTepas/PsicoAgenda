import dotenv from "dotenv";

// `import.meta.dirname` funciona porque apps/api es ESM ("type": "module").
// dist/ replica la profundidad de src/, así que la ruta relativa es estable en dev y en build.
dotenv.config({ path: new URL("../../.env", import.meta.url) });

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
} as const;
