-- La psicóloga ya no cambia el horario de una cita directamente: lo propone y el
-- paciente acepta o rechaza, igual que una solicitud pero en sentido contrario.
ALTER TABLE solicitudes_cita ADD COLUMN IF NOT EXISTS propuesta_por_psicologo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE solicitudes_cita ADD COLUMN IF NOT EXISTS cita_original_id UUID REFERENCES citas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS solicitudes_cita_cita_original_id_idx ON solicitudes_cita (cita_original_id);
