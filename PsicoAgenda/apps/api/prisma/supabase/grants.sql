-- =============================================================================
-- Privilegios de `postgres` sobre el esquema de la aplicacion.
--
-- EJECUTAR UNA SOLA VEZ, DESPUES de `prisma migrate deploy`:
--
--   npx prisma db execute --file prisma/supabase/grants.sql
--
-- POR QUE HACE FALTA
-- ------------------
-- Las tablas de `public` las crea el rol `prisma` (es quien aplica las
-- migraciones), asi que su dueno es `prisma`. En PostgreSQL el dueno no comparte
-- sus privilegios automaticamente: el rol `postgres` de Supabase, que es el que
-- ejecuta el SQL Editor del dashboard, no es superusuario y se queda **sin**
-- INSERT/UPDATE/DELETE sobre esas tablas.
--
-- Sintoma si se omite: cualquier escritura desde el SQL Editor falla con
--   ERROR: 42501: permission denied for table <tabla>
-- Por ejemplo al recrear las cuentas demo de `.env.credenciales`.
--
-- `ALTER DEFAULT PRIVILEGES` cubre los objetos que cree `prisma` en el futuro
-- (las tablas de las proximas migraciones), de modo que no hay que repetir los
-- GRANT tras cada `migrate deploy`.
--
-- No se otorga nada a `anon`, `authenticated` ni `service_role`: la API es la
-- unica via de acceso a los datos y su autorizacion vive en `requireRole`. La
-- Data API no expone `public`, asi que PostgREST tampoco los necesita.
--
-- Este archivo no contiene funciones PL/pgSQL a proposito: `@prisma/adapter-pg`
-- parte los scripts por `;` y romperia un cuerpo `$$ ... $$`.
-- =============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE prisma IN SCHEMA public
  GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE prisma IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE prisma IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres;
