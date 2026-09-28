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
  jwtSecret: requiredInProduction("JWT_SECRET", process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  allowDemoLogin: process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_LOGIN !== "false",
} as const;
