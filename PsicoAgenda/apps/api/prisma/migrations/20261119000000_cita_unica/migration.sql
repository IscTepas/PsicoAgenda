-- Cita única: la psicóloga agenda a alguien sin que pase por el registro.
-- El paciente existe sin cuenta de acceso (correo reservado `.invalid`, como los
-- menores que registra un tutor) y queda marcado para poder invitarlo después.
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS cita_unica BOOLEAN NOT NULL DEFAULT false;

-- Correo real de contacto de quien no tiene cuenta. No vive en `usuarios.correo`
-- porque ese es el de la cuenta: si estuviera ahí, al registrarse con su correo
-- chocaría con el índice único y el alta fallaría.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo_contacto TEXT;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuarios_correo_contacto;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_correo_contacto CHECK (
  correo_contacto IS NULL OR (length(correo_contacto) <= 254 AND correo_contacto LIKE '%_@_%._%')
);
