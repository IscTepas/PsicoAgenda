#!/usr/bin/env node
/**
 * Mantenimiento mensual de las tablas operativas (ticket
 * 2026-11-03-purga-automatica-de-datos-operativos).
 *
 * `VACUUM (ANALYZE)` no puede ejecutarse dentro de una petición HTTP ni de la
 * transacción implícita de Prisma, así que vive aquí y se corre a mano una vez
 * al mes. La purga diaria del endpoint reutiliza el espacio, pero el archivo no
 * se achica: lo relevante es que las estadísticas estén al día y que Postgres
 * reutilice las tuplas muertas.
 *
 *   BACKUP_DATABASE_URL  conexión DIRECTA o session pooler (5432). El pooler de
 *                        transacciones (6543) no admite VACUUM.
 *
 * Uso: node scripts/mantenimiento-bd.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const aqui = path.dirname(fileURLToPath(import.meta.url));

// En local, reutiliza el .env de la API (mismo archivo que usa el respaldo).
for (const archivo of [path.join(aqui, "..", "apps", "api", ".env"), path.join(aqui, "..", ".env")]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    // El archivo es opcional: en CI las variables llegan del entorno.
  }
}

const url = process.env.BACKUP_DATABASE_URL;
if (!url) {
  console.error("Falta BACKUP_DATABASE_URL (conexión directa o session pooler en el puerto 5432).");
  process.exit(1);
}

const TABLAS = ["notificaciones", "solicitudes_cita", "cache_registro"];

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const tamano = async () => {
  const { rows } = await pool.query(
    "SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano",
  );
  return rows[0]?.tamano ?? "desconocido";
};

const tuplasMuertas = async () => {
  const { rows } = await pool.query(
    `SELECT relname, n_dead_tup
       FROM pg_stat_user_tables
      WHERE relname = ANY($1::text[])
      ORDER BY relname`,
    [TABLAS],
  );
  return rows.map((fila) => `${fila.relname}=${fila.n_dead_tup}`).join(" ");
};

try {
  console.log(`Base: ${await tamano()}`);
  console.log(`Tuplas muertas antes: ${await tuplasMuertas()}`);

  const inicio = Date.now();
  await pool.query(`VACUUM (ANALYZE) ${TABLAS.join(", ")}`);
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(`VACUUM (ANALYZE) completado en ${segundos}s`);
  console.log(`Tuplas muertas después: ${await tuplasMuertas()}`);
  console.log(`Base: ${await tamano()}`);
} catch (error) {
  console.error("El mantenimiento de la base falló:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
