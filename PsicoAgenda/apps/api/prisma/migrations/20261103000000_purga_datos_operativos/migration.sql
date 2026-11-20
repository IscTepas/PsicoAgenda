-- =============================================================================
-- Purga de datos operativos: índices de apoyo y control de bloat.
--
-- Solo toca las tablas de alta rotación (`notificaciones`, `solicitudes_cita`,
-- `cache_registro`). Los datos clínicos y de negocio no se purgan: su retención
-- es una decisión legal, no técnica.
--
-- Los índices siguen el orden (estado, creado_en) que usan las consultas de
-- `mantenimiento.service.ts`; sin ellos, cada barrido recorrería la tabla
-- completa. Los parámetros de autovacuum son más agresivos que el umbral global
-- porque cada aviso se actualiza varias veces (crear, reclamar, enviar, estado
-- de entrega) y deja tuplas muertas.
-- =============================================================================

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notificaciones_purga"
  ON "notificaciones" ("estado", "creado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_solicitudes_purga"
  ON "solicitudes_cita" ("estado", "creado_en");

-- Tablas de alta rotación: recuperar espacio antes del umbral global (20 %).
-- 2 % de tuplas muertas o 50 filas, lo que ocurra primero.
ALTER TABLE "notificaciones" SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 50
);

ALTER TABLE "cache_registro" SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 50
);
