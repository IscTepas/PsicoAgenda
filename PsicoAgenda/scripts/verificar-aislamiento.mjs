#!/usr/bin/env node
/**
 * Verifica que el entorno aislado no toca producción
 * (ticket 2026-10-28-aislar-previews-de-produccion).
 *
 *   1. Muestra los conteos de las tablas clínicas en los dos proyectos.
 *   2. Escribe una fila marca en la base AISLADA y comprueba que NO aparece en
 *      producción; después la borra de la aislada.
 *
 * Variables de entorno:
 *
 *   PREVIEW_PRISMA_DATABASE_URL   rol prisma del proyecto aislado (obligatoria).
 *   PROD_DATABASE_URL             rol prisma de producción; si falta se toma
 *                                 DATABASE_URL de apps/api/.env (solo lectura).
 *
 * Salvaguarda: aborta si ambos destinos tienen el mismo ref.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg.default ?? pg;
const repo = new URL("../", import.meta.url);
const ruta = (rel) => fileURLToPath(new URL(rel, repo));

const previewUrl = process.env.PREVIEW_PRISMA_DATABASE_URL ?? "";
if (!previewUrl) {
  console.error("Falta PREVIEW_PRISMA_DATABASE_URL (rol prisma del proyecto aislado).");
  process.exit(2);
}

const envProduccion = readFileSync(ruta("apps/api/.env"), "utf8");
const prodUrl = process.env.PROD_DATABASE_URL ?? envProduccion.match(/DATABASE_URL="([^"]+)"/)?.[1];
if (!prodUrl) {
  console.error("No se encontró la cadena de producción (PROD_DATABASE_URL o apps/api/.env).");
  process.exit(2);
}

const refDe = (url) => url.match(/:\/\/(?:postgres|prisma)\.([a-z0-9]{6,})[:@]/)?.[1] ?? null;
const refProd = refDe(prodUrl);
const refPreview = refDe(previewUrl);
if (refProd && refPreview && refProd === refPreview) {
  console.error(
    `ABORTADO: PREVIEW y producción son el mismo proyecto (${refProd}). La verificación no dice nada.`,
  );
  process.exit(3);
}

const conectar = async (url) => {
  // Supabase exige TLS; un PostgreSQL local de pruebas no lo trae configurado.
  const esLocal = /@(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/)/.test(url);
  const client = new Client({
    connectionString: url,
    ...(esLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await client.connect();
  return client;
};

const TABLAS = [
  "usuarios",
  "pacientes",
  "citas",
  "solicitudes_cita",
  "expedientes_clinicos",
  "entradas_bitacora",
  "notificaciones",
  "consentimientos_informados",
];

const conteos = async (client) => {
  const salida = {};
  for (const tabla of TABLAS) {
    const r = await client.query(`SELECT count(*)::bigint AS n FROM public."${tabla}"`);
    salida[tabla] = r.rows[0].n;
  }
  return salida;
};

const prod = await conectar(prodUrl);
const preview = await conectar(previewUrl);

try {
  const [antesProd, conteosPreview] = await Promise.all([conteos(prod), conteos(preview)]);

  // Marca: una fila que solo puede existir si se escribió en la base aislada.
  const marca = randomUUID();
  await preview.query(
    `INSERT INTO public.registros_auditoria (id, accion, entidad, entidad_id, detalle)
     VALUES ($1, 'AISLAMIENTO_TEST', 'preview-aislado', $2, $3)`,
    [randomUUID(), marca, JSON.stringify({ prueba: "aislamiento", cuando: new Date().toISOString() })],
  );

  const enProd = await prod.query(
    "SELECT count(*)::int AS n FROM public.registros_auditoria WHERE entidad_id = $1",
    [marca],
  );
  const enPreview = await preview.query(
    "SELECT count(*)::int AS n FROM public.registros_auditoria WHERE entidad_id = $1",
    [marca],
  );
  await preview.query("DELETE FROM public.registros_auditoria WHERE entidad_id = $1", [marca]);

  console.log(`Producción: ref ${refProd ?? "?"}   Aislado: ref ${refPreview ?? "?"}\n`);
  console.log("Tabla".padEnd(28) + "Producción".padStart(12) + "Aislado".padStart(12));
  for (const tabla of TABLAS) {
    console.log(
      tabla.padEnd(28) + String(antesProd[tabla]).padStart(12) + String(conteosPreview[tabla]).padStart(12),
    );
  }

  console.log(`\nMarca ${marca}`);
  console.log(`  en la base aislada:   ${enPreview.rows[0].n === 1 ? "presente (esperado)" : "NO apareció"}`);
  console.log(`  en producción:        ${enProd.rows[0].n === 0 ? "ausente (esperado)" : "APARECIÓ — AISLAMIENTO ROTO"}`);

  if (enPreview.rows[0].n !== 1 || enProd.rows[0].n !== 0) {
    console.error("\nLa verificación falló: la escritura no quedó confinada al proyecto aislado.");
    process.exit(1);
  }
  console.log("\nAislamiento verificado: la escritura quedó confinada al proyecto aislado.");
} finally {
  await prod.end();
  await preview.end();
}
