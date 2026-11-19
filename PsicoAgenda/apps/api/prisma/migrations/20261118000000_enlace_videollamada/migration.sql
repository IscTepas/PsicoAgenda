-- Enlace fijo de videollamada de la psicóloga (Meet, Zoom…). Lo usan ella y sus
-- pacientes para entrar a las sesiones en línea.
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS enlace_videollamada TEXT;

ALTER TABLE psicologos DROP CONSTRAINT IF EXISTS ck_psicologos_enlace_videollamada;
ALTER TABLE psicologos ADD CONSTRAINT ck_psicologos_enlace_videollamada
  CHECK (enlace_videollamada IS NULL OR (enlace_videollamada ~ '^https://' AND length(enlace_videollamada) <= 300));
