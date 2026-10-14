-- =============================================================================
-- Disparadores de sincronización entre `auth.users` y el perfil `public.usuarios`.
--
-- EJECUTAR UNA SOLVEZ, DESPUÉS de `prisma migrate deploy`, con un rol que tenga
-- privilegio TRIGGER sobre `auth.users`: en el SQL Editor del dashboard de Supabase
-- (Dashboard -> SQL Editor) o con la Management API, que ejecutan como `postgres`.
--
-- ORDEN DE ARRANQUE
--   1. prisma/supabase/bootstrap.sql   -> crea el rol `prisma`
--   2. prisma migrate deploy           -> crea el esquema en español y las cuatro
--                                        funciones (baseline_esquema_espanol)
--   3. prisma/supabase/auth_user_triggers.sql -> este archivo
--
-- POR QUÉ ESTA SEPARACIÓN
-- -----------------------
-- `auth.users` es propiedad de `supabase_auth_admin`. Crear un disparador sobre ella
-- exige USAGE del schema `auth` y privilegio TRIGGER sobre la tabla, y el rol de
-- aplicación `prisma` no puede adquirirlos (ni siquiera delegándoselos). Si el DDL
-- de los disparadores viviera en `prisma/migrations/`, `migrate deploy` fallaría con
-- `permission denied for schema auth` y bloquearía TODAS las migraciones siguientes.
--
-- Por eso las funciones viven en la migración baseline (Prisma puede crearlas: es
-- dueño de las tablas que escriben) y los disparadores en este script.
--
-- Consecuencia operativa: `migrate status` no cubre este archivo. Si se modifica,
-- hay que volver a aplicarlo; el script es idempotente.
--
-- Las funciones referenciadas son SECURITY DEFINER y su dueño es el rol `prisma`,
-- así que se ejecutan con los privilegios de ese rol aunque el disparador lo dispare
-- GoTrue como `supabase_auth_admin`.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_business_role ON auth.users;

-- El rol de negocio se siembra ANTES del insert y sin SECURITY DEFINER, de modo que
-- corre como `supabase_auth_admin` y puede reescribir NEW.raw_app_meta_data. El claim
-- queda en inglés (PATIENT), que es lo que leen la API y la web; la traducción al
-- enum español (`rol_usuario`) la hace `handle_new_user` al escribir en la base.
CREATE TRIGGER on_auth_user_business_role
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_business_role();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Relleno de las cuentas que ya existan sin rol en el claim. Necesita `postgres`:
-- `prisma` no puede escribir `auth.users`. Solo toca las que no declaran rol, así que
-- no pisa ninguna promoción. El valor sigue en inglés: es el claim, no la columna.
UPDATE auth.users
   SET raw_app_meta_data = jsonb_set(
         coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"PATIENT"'::jsonb, true)
 WHERE raw_app_meta_data ->> 'role' IS NULL
    OR upper(raw_app_meta_data ->> 'role') NOT IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN');

-- Verificación posterior: deben aparecer las cuatro filas, y `on_auth_user_business_role`
-- debe ser BEFORE/INSERT mientras los otros tres son AFTER.
--   SELECT tgname, CASE WHEN (tgtype & 2) > 0 THEN 'BEFORE' ELSE 'AFTER' END AS momento
--     FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
--    ORDER BY tgname;
--   SELECT email, raw_app_meta_data ->> 'role' FROM auth.users;
