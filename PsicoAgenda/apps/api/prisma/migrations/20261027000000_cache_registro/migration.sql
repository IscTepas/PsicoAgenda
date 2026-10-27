-- Códigos de registro fuera de la memoria del proceso.
--
-- En serverless (Vercel) cada petición puede caer en una instancia distinta, así
-- que el código que genera una tiene que poder verificar otra. Las columnas
-- replican la interfaz CacheStore de `codigo.service.ts`: clave/valor/vencimiento.
--
-- No se usa `migrate dev` en este proyecto (la baseline contiene CHECK, índices
-- GiST y vistas que Prisma no modela y reportaría drift); las filas vencidas se
-- borran de forma perezosa al leerlas y en cada barrido del cron.

CREATE TABLE IF NOT EXISTS cache_registro (
  clave          TEXT NOT NULL,
  valor          TEXT NOT NULL,
  expira_en      TIMESTAMPTZ(3) NOT NULL,
  actualizado_en TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cache_registro_pkey PRIMARY KEY (clave)
);

CREATE INDEX IF NOT EXISTS cache_registro_expira_en_idx ON cache_registro (expira_en);
