-- =============================================================================
-- Bootstrap del rol de aplicación `prisma` para Supabase (PostgreSQL gestionado).
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor del dashboard de Supabase
-- (Dashboard -> SQL Editor -> New query -> Run). El script es idempotente:
-- puede ejecutarse de nuevo sin efectos secundarios.
--
-- La contraseña se genera dentro del script y se muestra en el panel de avisos
-- del SQL Editor. No la escribas en ningún archivo del repositorio:
-- entrégala por variable de entorno (DATABASE_URL) y consérvala en un gestor
-- de contraseñas.
--
-- Verificación posterior:
--   SELECT rolname, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = 'prisma';
-- =============================================================================

-- Si prefieres fijar la contraseña a mano, descomenta esta línea y sustituye
-- el valor ANTES de ejecutar el script; el bloque de abajo la respetará.
-- SET psicoagenda.prisma_password = 'cambia-esta-contrasena';

DO $$
DECLARE
  prisma_password text;
BEGIN
  prisma_password := current_setting('psicoagenda.prisma_password', true);

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prisma') THEN
    IF prisma_password IS NULL OR prisma_password = '' THEN
      prisma_password := encode(gen_random_bytes(24), 'hex');
    END IF;

    EXECUTE format('CREATE ROLE prisma LOGIN PASSWORD %L', prisma_password);
    RAISE NOTICE 'Rol prisma creado. Contraseña: %', prisma_password;
  ELSE
    RAISE NOTICE 'El rol prisma ya existe: se conservan sus atributos y credenciales.';
  END IF;
END
$$;

-- createdb    : @prisma/adapter-pg implementa connectToShadowDb() creando
--               prisma_migrate_shadow_db_<uuid>; sin este atributo `migrate dev` falla.
-- bypassrls    : hace explícita la intención de que la API no queda sujeta a RLS.
--               La API es la única vía de acceso a los datos y su autorización
--               vive en requireRole.
-- NOSUPERUSER  : el rol no administra el servidor; solo accede a la base de datos
--               de la aplicación.
ALTER ROLE prisma WITH LOGIN CREATEDB BYPASSRLS;
-- PostgreSQL 15 quitó el CREATE por defecto sobre `public` para PUBLIC, y el rol
-- `postgres` de Supabase no es superusuario ni es dueño de los objetos de `public`.
-- Por eso los grants explícitos son obligatorios, no cosméticos.
GRANT CONNECT ON DATABASE postgres TO prisma;
GRANT USAGE, CREATE ON SCHEMA public TO prisma;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prisma;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prisma;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO prisma;

-- `prisma migrate` se conecta con el rol `prisma`, así que las tablas que crea le
-- pertenecen y no necesita ningún grant adicional sobre ellas. Estos
-- ALTER DEFAULT PRIVILEGES solo cubren objetos que cree `postgres` en `public`
-- (por ejemplo los que agregue el proveedor); sin ellos el rol `prisma` no podría
-- leerlos una vez creados.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO prisma;

-- Nota operativa: los triggers sobre `auth.users` NO pueden ir en
-- `prisma/migrations/`. Esa tabla es de `supabase_auth_admin` y crear disparadores
-- sobre ella exige privilegios que el rol `prisma` no tiene ni puede recibir, de
-- modo que `migrate deploy` fallaría con `permission denied for schema auth` y
-- bloquearía las migraciones siguientes. Las FUNCIONES sí se definen en una
-- migración (`*_auth_user_profile_sync`), pero los disparadores se crean aparte,
-- con `postgres`, desde `prisma/supabase/auth_user_triggers.sql`.
