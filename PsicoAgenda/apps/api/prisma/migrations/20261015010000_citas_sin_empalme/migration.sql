-- =============================================================================
-- Anti-solape real de citas.
--
-- Los índices GiST de la baseline (`ex_citas_*_sin_empalme`) se llamaban
-- "sin_empalme" pero eran `CREATE INDEX ... USING gist` NO únicos: solo aceleran
-- la búsqueda de solapes, no impiden dos citas encimadas. Esta migración los
-- reemplaza por constraints EXCLUDE, que sí rechazan la inserción (error 23P01).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

SET search_path = public, extensions;

-- Reemplazan a los índices no únicos homónimos (el EXCLUDE crea su propio índice).
DROP INDEX IF EXISTS "ex_citas_paciente_sin_empalme";
DROP INDEX IF EXISTS "ex_citas_psicologo_sin_empalme";

ALTER TABLE "citas"
  ADD CONSTRAINT "excl_citas_psicologo_sin_empalme"
  EXCLUDE USING gist (
    "psicologo_id" WITH =,
    tstzrange("inicio", "fin") WITH &&
  )
  WHERE ("estado" = ANY (ARRAY['PENDIENTE'::"estado_cita", 'CONFIRMADA'::"estado_cita"]));

ALTER TABLE "citas"
  ADD CONSTRAINT "excl_citas_paciente_sin_empalme"
  EXCLUDE USING gist (
    "paciente_id" WITH =,
    tstzrange("inicio", "fin") WITH &&
  )
  WHERE ("estado" = ANY (ARRAY['PENDIENTE'::"estado_cita", 'CONFIRMADA'::"estado_cita"]));
