-- El aviso de una solicitud apunta a ella, para que la interfaz lleve directo a
-- responderla. Si la solicitud se borra, el aviso queda (sin enlace).
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS solicitud_id UUID;
ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS notificaciones_solicitud_id_fkey;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_solicitud_id_fkey
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes_cita (id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS notificaciones_solicitud_id_idx ON notificaciones (solicitud_id);
