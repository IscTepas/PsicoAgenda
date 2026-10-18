-- La solicitud guarda lo que el paciente eligió (modalidad y duración) para que
-- la cita creada al aceptarla sea exactamente la que pidió.
ALTER TABLE solicitudes_cita ADD COLUMN IF NOT EXISTS modalidad modalidad_cita NOT NULL DEFAULT 'PRESENCIAL';
ALTER TABLE solicitudes_cita ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER NOT NULL DEFAULT 50;
