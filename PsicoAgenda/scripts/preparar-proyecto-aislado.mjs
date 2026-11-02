#!/usr/bin/env node
/**
 * Prepara el proyecto de Supabase del entorno aislado
 * (ticket 2026-10-28-aislar-previews-de-produccion).
 *
 * Aplica, en orden e idempotente: bootstrap del rol `prisma`, migraciones
 * versionadas, grants a `postgres`, triggers de identidad sobre `auth.users`
 * y las cuentas demo sintéticas. Al final verifica el resultado y deja el
 * checklist de los pasos que solo se hacen en el dashboard.
 *
 * Variables de entorno:
 *
 *   PREVIEW_ADMIN_DATABASE_URL    rol `postgres` del proyecto aislado (conexión
 *                                 directa `db.<ref>.supabase.co` o pooler sesión 5432).
 *                                 Es la contraseña de base de datos elegida al crear
 *                                 el proyecto; la usa el SQL Editor del dashboard.
 *   PREVIEW_PRISMA_DATABASE_URL   rol `prisma.<ref>` por Supavisor sesión (5432), con
 *                                 la contraseña que generó `bootstrap.sql`.
 *   PREVIEW_SUPABASE_URL          opcional; solo para mostrar el ref en el resumen.
 *
 * Salvaguarda: aborta si el proyecto destino tiene el mismo ref que producción
 * (leído de `apps/api/.env`). El entorno aislado NUNCA comparte ref con ella.
 *
 * Uso:
 *   PREVIEW_ADMIN_DATABASE_URL=... node scripts/preparar-proyecto-aislado.mjs --solo-bootstrap
 *   PREVIEW_ADMIN_DATABASE_URL=... PREVIEW_PRISMA_DATABASE_URL=... node scripts/preparar-proyecto-aislado.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg.default ?? pg;
const repo = new URL("../", import.meta.url);
const ruta = (rel) => fileURLToPath(new URL(rel, repo));

const adminUrl = process.env.PREVIEW_ADMIN_DATABASE_URL ?? "";
const prismaUrl = process.env.PREVIEW_PRISMA_DATABASE_URL ?? "";
const soloBootstrap = process.argv.includes("--solo-bootstrap");

if (!adminUrl) {
  console.error("Falta PREVIEW_ADMIN_DATABASE_URL (rol postgres del proyecto aislado).");
  process.exit(2);
}
if (!soloBootstrap && !prismaUrl) {
  console.error("Falta PREVIEW_PRISMA_DATABASE_URL (rol prisma del proyecto aislado).");
  process.exit(2);
}

// --- Salvaguarda: producción y aislamiento no pueden ser el mismo proyecto ---
const refDe = (url) =>
  url.match(/https?:\/\/([a-z0-9]{6,})\.supabase\.co/)?.[1] ??
  url.match(/:\/\/(?:postgres|prisma)\.([a-z0-9]{6,})[:@]/)?.[1] ??
  url.match(/:\/\/db\.([a-z0-9]{6,})\.supabase\.co/)?.[1] ??
  null;

const envProduccion = readFileSync(ruta("apps/api/.env"), "utf8");
const refProduccion = refDe(envProduccion.match(/SUPABASE_URL="([^"]+)"/)?.[1] ?? "");
const refPreview = refDe(adminUrl) ?? refDe(prismaUrl) ?? refDe(process.env.PREVIEW_SUPABASE_URL ?? "");

if (refPreview && refProduccion && refPreview === refProduccion) {
  console.error(
    `ABORTADO: el destino es el proyecto de producción (${refProduccion}). ` +
      "El entorno aislado debe ser un proyecto de Supabase distinto.",
  );
  process.exit(3);
}

const archivos = {
  bootstrap: ruta("apps/api/prisma/supabase/bootstrap.sql"),
  grants: ruta("apps/api/prisma/supabase/grants.sql"),
  triggers: ruta("apps/api/prisma/supabase/auth_user_triggers.sql"),
  demo: ruta("apps/api/prisma/supabase/demo_accounts.sql"),
  demoData: ruta("apps/api/prisma/supabase/demo_data.sql"),
};
const migracionesLocales = readdirSync(ruta("apps/api/prisma/migrations"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).length;

const TRIGGERS_ESPERADOS = [
  "on_auth_user_business_role",
  "on_auth_user_created",
  "on_auth_user_deleted",
  "on_auth_user_updated",
];

const conectar = async (url, etiqueta) => {
  // Supabase exige TLS; un PostgreSQL local de pruebas no lo trae configurado.
  const esLocal = /@(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/)/.test(url);
  const client = new Client({
    connectionString: url,
    ...(esLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  client.on("notice", (msg) => console.log(`  [${etiqueta}] ${msg.message}`));
  await client.connect();
  return client;
};

const ejecutarArchivo = async (client, archivo, etiqueta) => {
  await client.query(readFileSync(archivo, "utf8"));
  console.log(`  OK ${etiqueta}`);
};

const fallos = [];
const paso = async (nombre, fn) => {
  process.stdout.write(`• ${nombre} ... `);
  try {
    const detalle = await fn();
    console.log(detalle ?? "ok");
  } catch (error) {
    console.log("FALLO");
    console.error(`  ${error.message}`);
    fallos.push(nombre);
  }
};

console.log(`Preparando el entorno aislado${refPreview ? ` (ref ${refPreview})` : ""}.\n`);

const admin = await conectar(adminUrl, "postgres");

// 1. Rol de aplicación. Si no existía, bootstrap.sql genera la contraseña y la
//    imprime como notice (arriba): hay que guardarla y usarla en PRISMA_DATABASE_URL.
await paso("bootstrap del rol prisma", async () => {
  await ejecutarArchivo(admin, archivos.bootstrap, "bootstrap.sql");
  const r = await admin.query(
    "SELECT rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = 'prisma'",
  );
  if (!r.rows[0]?.rolcreatedb || !r.rows[0]?.rolbypassrls) {
    throw new Error("el rol prisma existe pero sin createdb o bypassrls");
  }
  return "rol prisma con createdb y bypassrls";
});

if (soloBootstrap) {
  await admin.end();
  console.log(`
Solo bootstrap. Guarda la contraseña que generó el script (notice de arriba) y
repite con PREVIEW_PRISMA_DATABASE_URL=postgresql://prisma.<ref>:<contraseña>@aws-<N>-<region>.pooler.supabase.com:5432/postgres`);
  process.exit(fallos.length ? 1 : 0);
}

const prisma = await conectar(prismaUrl, "prisma");

// 2. Migraciones versionadas (el flujo del proyecto: migrate deploy, sin sombra).
await paso("migraciones versionadas", async () => {
  const cli = ruta("node_modules/prisma/build/index.js");
  const r = spawnSync(
    process.execPath,
    [cli, "migrate", "deploy"],
    {
      stdio: "pipe",
      encoding: "utf8",
      // Prisma 7 busca `prisma.config.ts` en el directorio de trabajo.
      cwd: ruta("apps/api"),
      env: { ...process.env, DATABASE_URL: prismaUrl },
    },
  );
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").at(-1));
  return "migrate deploy aplicado";
});

// 3. Grants: `postgres` (el SQL Editor) recupera escritura sobre las tablas de prisma.
await paso("grants a postgres", () => ejecutarArchivo(prisma, archivos.grants, "grants.sql"));

// 4. Triggers de identidad: necesitan privilegios sobre auth.users (rol postgres).
await paso("triggers de identidad", async () => {
  await ejecutarArchivo(admin, archivos.triggers, "auth_user_triggers.sql");
  const r = await admin.query(
    "SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal",
  );
  const actuales = r.rows.map((x) => x.tgname).sort();
  const faltan = TRIGGERS_ESPERADOS.filter((t) => !actuales.includes(t));
  if (faltan.length) throw new Error(`faltan triggers: ${faltan.join(", ")}`);

  // Alta de prueba dentro de una transacción: comprueba el trigger completo y
  // se revierte para no dejar identidades ni perfiles de verificación.
  await admin.query("BEGIN");
  try {
    const alta = await admin.query(
      `INSERT INTO auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data
       )
       VALUES (
         '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
         $2, '', now(), now(), now(),
         '{"provider":"email","providers":["email"],"role":"PATIENT"}'::jsonb,
         $3::jsonb
       )
       RETURNING id`,
      [randomUUID(), `verificacion-trigger-${Date.now()}@example.com`, '{"name":"Verificación Trigger"}'],
    );
    const usuarioId = alta.rows[0].id;
    const perfil = await admin.query("SELECT rol::text AS rol FROM public.usuarios WHERE id = $1", [
      usuarioId,
    ]);
    const paciente = await admin.query("SELECT id FROM public.pacientes WHERE usuario_id = $1", [
      usuarioId,
    ]);
    if (perfil.rows[0]?.rol !== "PACIENTE") {
      throw new Error("el trigger no creó el perfil PACIENTE del alta de prueba");
    }
    if (!paciente.rows[0]) {
      throw new Error("el trigger no creó el paciente del alta de prueba");
    }
  } finally {
    await admin.query("ROLLBACK");
  }

  return `4/4 triggers y alta de prueba crea perfil + paciente`;
});

// 5. Datos sintéticos: cuentas demo y un caso completo, nunca una copia de producción.
await paso("datos sintéticos (cuentas y caso demo)", async () => {
  await ejecutarArchivo(admin, archivos.demo, "demo_accounts.sql");
  await ejecutarArchivo(admin, archivos.demoData, "demo_data.sql");
  const auth = await admin.query(
    "SELECT count(*)::int AS n FROM auth.users WHERE email LIKE '%.demo@example.com'",
  );
  const perfiles = await prisma.query(
    "SELECT count(*)::int AS n FROM public.usuarios WHERE correo LIKE '%.demo@example.com'",
  );
  const caso = await prisma.query(
    `SELECT
       (SELECT count(*)::int FROM public.citas c
          JOIN public.pacientes p ON p.id = c.paciente_id
          JOIN public.usuarios u ON u.id = p.usuario_id
         WHERE u.correo = 'paciente.demo@example.com') AS citas,
       (SELECT count(*)::int FROM public.expedientes_clinicos e
          JOIN public.pacientes p ON p.id = e.paciente_id
          JOIN public.usuarios u ON u.id = p.usuario_id
         WHERE u.correo = 'paciente.demo@example.com') AS expedientes,
       (SELECT count(*)::int FROM public.entradas_bitacora b
          JOIN public.expedientes_clinicos e ON e.id = b.expediente_id
          JOIN public.pacientes p ON p.id = e.paciente_id
          JOIN public.usuarios u ON u.id = p.usuario_id
         WHERE u.correo = 'paciente.demo@example.com') AS entradas`,
  );
  if (auth.rows[0].n < 2 || perfiles.rows[0].n < 2) {
    throw new Error(`demo incompleto: ${auth.rows[0].n} identidades, ${perfiles.rows[0].n} perfiles`);
  }
  if (caso.rows[0].citas < 4 || caso.rows[0].expedientes < 1 || caso.rows[0].entradas < 1) {
    throw new Error(
      `caso demo incompleto: ${caso.rows[0].citas} citas, ${caso.rows[0].expedientes} expedientes, ${caso.rows[0].entradas} entradas`,
    );
  }
  return `${auth.rows[0].n} identidades, ${caso.rows[0].citas} citas, ${caso.rows[0].expedientes} expediente(s) y ${caso.rows[0].entradas} entrada(s)`;
});

// 6. Verificación de paridad con el historial versionado.
await paso("paridad de migraciones", async () => {
  const r = await prisma.query(
    "SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL",
  );
  if (r.rows[0].n !== migracionesLocales) {
    throw new Error(`aplicadas ${r.rows[0].n} != ${migracionesLocales} versionadas en el repo`);
  }
  return `${r.rows[0].n}/${migracionesLocales} migraciones aplicadas (producción tiene ${migracionesLocales})`;
});

await admin.end();
await prisma.end();

console.log(`
Pasos que quedan FUERA del script (dashboard del proyecto aislado):
  1. Authentication → Signing Keys: usar claves asimétricas y verificar el JWKS
     (curl $PREVIEW_SUPABASE_URL/auth/v1/.well-known/jwks.json).
  2. Settings → API → Exposed schemas: quitar "public" (cierra la Data API).
  3. Vercel: variables del proyecto aislado con alcance SOLO Preview
     (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENTORNO_BD=preview,
     GMAIL_*, CRON_SECRET) y las de producción solo con alcance Production.
  4. Verificación en el preview desplegado: scripts/verificar-aislamiento.mjs.
`);

if (fallos.length) {
  console.error(`Fallaron: ${fallos.join(", ")}`);
  process.exit(1);
}
console.log("Entorno aislado preparado y verificado.");
