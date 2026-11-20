-- =============================================================================
-- Bloqueos de agenda: rangos en los que el psicólogo no atiende.
--
-- El rango se guarda como instantes; `todo_el_dia` es una bandera de
-- presentación (el cliente envía 00:00 local a 00:00 del día siguiente).
--
-- Dos bloqueos del mismo psicólogo no pueden solaparse: el EXCLUDE lo garantiza
-- incluso si dos peticiones concurrentes pasan la validación de la aplicación.
-- El solape bloqueo ↔ cita no puede expresarse con un EXCLUDE (son tablas
-- distintas) y se comprueba en `assertNoAgendaBlock`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "bloqueos_agenda" (
    "id" UUID NOT NULL,
    "psicologo_id" UUID NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(3) NOT NULL,
    "fecha_fin" TIMESTAMPTZ(3) NOT NULL,
    "todo_el_dia" BOOLEAN NOT NULL DEFAULT false,
    "motivo" VARCHAR(100),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bloqueos_agenda_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bloqueos_agenda_rango_valido" CHECK ("fecha_fin" > "fecha_inicio"),
    CONSTRAINT "bloqueos_agenda_psicologo_id_fkey"
      FOREIGN KEY ("psicologo_id") REFERENCES "psicologos" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bloqueos_agenda_psicologo_id_fecha_inicio_idx"
  ON "bloqueos_agenda" ("psicologo_id", "fecha_inicio");

CREATE EXTENSION IF NOT EXISTS btree_gist;

SET search_path = public, extensions;

ALTER TABLE "bloqueos_agenda"
  ADD CONSTRAINT "excl_bloqueos_sin_empalme"
  EXCLUDE USING gist (
    "psicologo_id" WITH =,
    tstzrange("fecha_inicio", "fecha_fin") WITH &&
  );
