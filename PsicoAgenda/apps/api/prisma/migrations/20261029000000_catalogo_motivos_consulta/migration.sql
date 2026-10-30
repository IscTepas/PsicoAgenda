-- Catálogo de motivos de consulta (ticket 2026-10-28-catalogo-de-motivos-de-consulta).
--
-- Solo agrega: la tabla, dos columnas nullable y sus FK. `citas.motivo` y
-- `solicitudes_cita.motivo` se conservan: guardan el texto de «Otro» y todo lo
-- histórico, que no se reclasifica. ON DELETE RESTRICT impide borrar un motivo en
-- uso; se desactiva (`activo = false`).

CREATE TABLE IF NOT EXISTS motivos_consulta (
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  codigo         TEXT NOT NULL,
  etiqueta       TEXT NOT NULL,
  categoria      TEXT NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,
  orden          INTEGER NOT NULL DEFAULT 0,
  es_otro        BOOLEAN NOT NULL DEFAULT false,
  requiere_texto BOOLEAN NOT NULL DEFAULT false,
  creado_en      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT motivos_consulta_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS motivos_consulta_codigo_key ON motivos_consulta (codigo);
CREATE INDEX IF NOT EXISTS motivos_consulta_activo_categoria_orden_idx
  ON motivos_consulta (activo, categoria, orden);

ALTER TABLE citas ADD COLUMN IF NOT EXISTS motivo_id UUID;
ALTER TABLE solicitudes_cita ADD COLUMN IF NOT EXISTS motivo_id UUID;

ALTER TABLE citas DROP CONSTRAINT IF EXISTS citas_motivo_id_fkey;
ALTER TABLE citas ADD CONSTRAINT citas_motivo_id_fkey
  FOREIGN KEY (motivo_id) REFERENCES motivos_consulta (id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE solicitudes_cita DROP CONSTRAINT IF EXISTS solicitudes_cita_motivo_id_fkey;
ALTER TABLE solicitudes_cita ADD CONSTRAINT solicitudes_cita_motivo_id_fkey
  FOREIGN KEY (motivo_id) REFERENCES motivos_consulta (id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carga inicial idempotente: por código, nunca pisa ediciones posteriores.
INSERT INTO motivos_consulta (codigo, etiqueta, categoria, orden, es_otro, requiere_texto) VALUES
  ('primera_consulta',    'Primera consulta',                    'Seguimiento',         10, false, false),
  ('seguimiento',         'Sesión de seguimiento',               'Seguimiento',         11, false, false),
  ('ansiedad',            'Ansiedad',                            'Ansiedad',            20, false, false),
  ('ataques_panico',      'Ataques de pánico',                   'Ansiedad',            21, false, false),
  ('estres',              'Estrés',                              'Ansiedad',            22, false, false),
  ('fobias',              'Fobias o miedos',                     'Ansiedad',            23, false, false),
  ('depresion',           'Tristeza o depresión',                'Estado de ánimo',     30, false, false),
  ('duelo',               'Duelo o pérdida',                     'Estado de ánimo',     31, false, false),
  ('autoestima',          'Autoestima',                          'Estado de ánimo',     32, false, false),
  ('pareja',              'Problemas de pareja',                 'Vinculares',          40, false, false),
  ('familia',             'Conflictos familiares',               'Vinculares',          41, false, false),
  ('crianza',             'Crianza',                             'Vinculares',          42, false, false),
  ('relaciones_sociales', 'Relaciones sociales',                 'Vinculares',          43, false, false),
  ('crecimiento',         'Crecimiento personal',                'Desarrollo personal', 50, false, false),
  ('biodescodificacion',  'Biodescodificación',                  'Desarrollo personal', 51, false, false),
  ('decisiones',          'Toma de decisiones',                  'Desarrollo personal', 52, false, false),
  ('sueno',               'Problemas de sueño',                  'Salud',               60, false, false),
  ('alimentacion',        'Alimentación',                        'Salud',               61, false, false),
  ('somatico',            'Síntomas físicos sin causa médica',   'Salud',               62, false, false),
  ('otro',                'Otro',                                'Otro',                99, true,  true)
ON CONFLICT (codigo) DO NOTHING;
