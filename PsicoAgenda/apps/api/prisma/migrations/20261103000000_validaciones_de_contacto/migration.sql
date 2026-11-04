-- Validaciones de datos de contacto en la base: la última línea de defensa si un
-- cliente se salta la API. La API (zod) y el formulario aplican las mismas reglas
-- con mensajes claros; aquí solo se impide guardar basura.
--
-- Teléfono: 10 dígitos, admite separadores ("311-123-4567"). En `usuarios` y
-- `tutores` sigue siendo opcional a nivel base (cuentas creadas por el proveedor de
-- identidad, contactos sin teléfono); que sea obligatorio en el perfil lo exige la app.

-- 1. Normalizar lo que ya existe para que las restricciones validen.
--    "+52 311 147 9910" → lada internacional de México: se conservan los 10 dígitos.
UPDATE usuarios
   SET telefono = right(regexp_replace(telefono, '[^0-9]', '', 'g'), 10)
 WHERE telefono IS NOT NULL
   AND regexp_replace(telefono, '[^0-9]', '', 'g') ~ '^52[0-9]{10}$';
--    Cualquier otro número que no tenga 10 dígitos no se puede corregir sin adivinar.
UPDATE usuarios
   SET telefono = NULL
 WHERE telefono IS NOT NULL
   AND length(regexp_replace(telefono, '[^0-9]', '', 'g')) <> 10;

-- 2. Restricciones.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuarios_nombre;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_nombre
  CHECK (length(btrim(nombre_completo)) >= 2);
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuarios_telefono;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_telefono
  CHECK (telefono IS NULL OR length(regexp_replace(telefono, '[^0-9]', '', 'g')) = 10);

ALTER TABLE contactos_emergencia DROP CONSTRAINT IF EXISTS ck_contactos_nombre;
ALTER TABLE contactos_emergencia ADD CONSTRAINT ck_contactos_nombre
  CHECK (length(btrim(nombre_completo)) >= 2);
ALTER TABLE contactos_emergencia DROP CONSTRAINT IF EXISTS ck_contactos_telefono;
ALTER TABLE contactos_emergencia ADD CONSTRAINT ck_contactos_telefono
  CHECK (length(regexp_replace(telefono, '[^0-9]', '', 'g')) = 10);

ALTER TABLE tutores DROP CONSTRAINT IF EXISTS ck_tutores_nombre;
ALTER TABLE tutores ADD CONSTRAINT ck_tutores_nombre
  CHECK (length(btrim(nombre_completo)) >= 2);
ALTER TABLE tutores DROP CONSTRAINT IF EXISTS ck_tutores_telefono;
ALTER TABLE tutores ADD CONSTRAINT ck_tutores_telefono
  CHECK (telefono IS NULL OR length(regexp_replace(telefono, '[^0-9]', '', 'g')) = 10);

ALTER TABLE psicologos DROP CONSTRAINT IF EXISTS ck_psicologos_cedula;
ALTER TABLE psicologos ADD CONSTRAINT ck_psicologos_cedula
  CHECK (length(btrim(cedula_profesional)) >= 4);
