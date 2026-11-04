-- Varios motivos por cita y por solicitud (antes, uno solo en `motivo_id`), y el
-- catálogo plano que definió la psicóloga. `motivo` (texto) sigue guardando lo que
-- se escribe en «Otro».

-- 1. Enlaces muchos a muchos. Un motivo en uso no se puede borrar (se desactiva).
CREATE TABLE IF NOT EXISTS citas_motivos (
  cita_id   UUID NOT NULL,
  motivo_id UUID NOT NULL,
  CONSTRAINT citas_motivos_pkey PRIMARY KEY (cita_id, motivo_id),
  CONSTRAINT citas_motivos_cita_id_fkey
    FOREIGN KEY (cita_id) REFERENCES citas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT citas_motivos_motivo_id_fkey
    FOREIGN KEY (motivo_id) REFERENCES motivos_consulta (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS citas_motivos_motivo_id_idx ON citas_motivos (motivo_id);

CREATE TABLE IF NOT EXISTS solicitudes_motivos (
  solicitud_id UUID NOT NULL,
  motivo_id    UUID NOT NULL,
  CONSTRAINT solicitudes_motivos_pkey PRIMARY KEY (solicitud_id, motivo_id),
  CONSTRAINT solicitudes_motivos_solicitud_id_fkey
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes_cita (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT solicitudes_motivos_motivo_id_fkey
    FOREIGN KEY (motivo_id) REFERENCES motivos_consulta (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS solicitudes_motivos_motivo_id_idx ON solicitudes_motivos (motivo_id);

-- 2. Copiar el motivo único que ya tenían y retirar la columna.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'citas' AND column_name = 'motivo_id') THEN
    INSERT INTO citas_motivos (cita_id, motivo_id)
    SELECT id, motivo_id FROM citas WHERE motivo_id IS NOT NULL ON CONFLICT DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'solicitudes_cita' AND column_name = 'motivo_id') THEN
    INSERT INTO solicitudes_motivos (solicitud_id, motivo_id)
    SELECT id, motivo_id FROM solicitudes_cita WHERE motivo_id IS NOT NULL ON CONFLICT DO NOTHING;
  END IF;
END
$$;

ALTER TABLE citas DROP COLUMN IF EXISTS motivo_id;
ALTER TABLE solicitudes_cita DROP COLUMN IF EXISTS motivo_id;

-- 3. Catálogo plano de la psicóloga. Lo que ya no está se desactiva (no se borra:
--    citas viejas lo siguen mostrando). Los códigos existentes se reutilizan.
UPDATE motivos_consulta
   SET activo = false
 WHERE codigo NOT IN ('tanatofobia', 'depresion_apatia', 'flojera', 'ansiedad', 'insomnio',
                      'adicciones', 'pareja', 'familia', 'autoestima', 'duelo', 'estres_laboral', 'otro');

INSERT INTO motivos_consulta (codigo, etiqueta, categoria, orden, es_otro, requiere_texto, activo) VALUES
  ('tanatofobia',      'Tanatofobia o miedo a la muerte',  'General', 10, false, false, true),
  ('depresion_apatia', 'Depresión o no querer hacer nada', 'General', 20, false, false, true),
  ('flojera',          'Flojera siempre',                  'General', 30, false, false, true),
  ('ansiedad',         'Ansiedad',                         'General', 40, false, false, true),
  ('insomnio',         'Insomnio',                         'General', 50, false, false, true),
  ('adicciones',       'Adicciones',                       'General', 60, false, false, true),
  ('pareja',           'Problemas de pareja',              'General', 70, false, false, true),
  ('familia',          'Problemas familiares',             'General', 80, false, false, true),
  ('autoestima',       'Autoestima y desvalorización',     'General', 90, false, false, true),
  ('duelo',            'Duelos y traumas',                 'General', 100, false, false, true),
  ('estres_laboral',   'Estrés laboral',                   'General', 110, false, false, true),
  ('otro',             'Otro',                             'General', 999, true, true, true)
ON CONFLICT (codigo) DO UPDATE
  SET etiqueta = EXCLUDED.etiqueta,
      categoria = EXCLUDED.categoria,
      orden = EXCLUDED.orden,
      es_otro = EXCLUDED.es_otro,
      requiere_texto = EXCLUDED.requiere_texto,
      activo = true;
