-- Tareas que la psicóloga deja en la hoja de bitácora de una sesión. El paciente
-- (o su tutor) las ve en su inicio y las marca como hechas.

ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'TAREA';

CREATE TABLE IF NOT EXISTS tareas_sesion (
  id          UUID NOT NULL,
  entrada_id  UUID NOT NULL,
  paciente_id UUID NOT NULL,
  texto       TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  hecha_en    TIMESTAMPTZ(3),
  creado_en   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT tareas_sesion_pkey PRIMARY KEY (id),
  CONSTRAINT tareas_sesion_entrada_id_fkey
    FOREIGN KEY (entrada_id) REFERENCES entradas_bitacora (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT tareas_sesion_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES pacientes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_tareas_sesion_texto CHECK (length(btrim(texto)) BETWEEN 1 AND 300)
);
CREATE INDEX IF NOT EXISTS tareas_sesion_entrada_id_idx ON tareas_sesion (entrada_id);
CREATE INDEX IF NOT EXISTS tareas_sesion_paciente_id_hecha_en_idx ON tareas_sesion (paciente_id, hecha_en);
