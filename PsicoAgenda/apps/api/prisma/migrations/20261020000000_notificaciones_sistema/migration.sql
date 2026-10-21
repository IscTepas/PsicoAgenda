-- Notificaciones por evento: el canal SISTEMA es la campana de la aplicación,
-- los tipos nuevos cubren solicitudes y asistencia, y `leida_en` persiste
-- la lectura (antes solo vivía en el navegador).
ALTER TYPE canal_notificacion ADD VALUE IF NOT EXISTS 'SISTEMA';
ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'SOLICITUD';
ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'RECHAZO';
ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'ASISTENCIA';

ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS leida_en TIMESTAMPTZ(3);
