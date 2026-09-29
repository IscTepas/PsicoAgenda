-- =============================================================================
-- Siembra del rol de negocio por defecto en `app_metadata`.
--
-- EL PROBLEMA QUE RESUELVE
-- ------------------------
-- `public.handle_new_user` (20260928000000_auth_user_profile_sync) ponía `PATIENT`
-- en `public.users.role` cuando el alta no declaraba rol, pero NO escribía
-- `app_metadata.role`. La API lee el rol de negocio del JWT, y `apps/api` falla
-- cerrada ante una sesión sin rol declarado, así que el resultado era:
--
--   registro público -> identidad creada, perfil PATIENT en la base
--                    -> `GET /api/auth/me` responde 401 "No autenticado"
--                    -> el usuario entra al panel pero ninguna llamada funciona
--
-- Se detectó recorriendo el alta real desde el navegador contra el proyecto. Ningún
-- alta pública era usable, y el fallo es silencioso en el alta: el alta responde
-- 200 y el perfil aparece con el rol correcto en la base.
--
-- POR QUÉ UN DISPARADOR BEFORE INSERT Y NO DENTRO DE `handle_new_user`
-- -------------------------------------------------------------------
-- Escribir `auth.users.raw_app_meta_data` exige ser `supabase_auth_admin`.
-- `handle_new_user` es SECURITY DEFINER con dueño `prisma`, así que dentro de ella
-- el UPDATE se ejecutaría como `prisma` y fallaría con `permission denied for table
-- users`. Y llamar a una función auxiliar sin SECURITY DEFINER desde dentro de una
-- SECURITY DEFINER tampoco ayuda: se ejecutaría con el usuario efectivo, que ya es
-- `prisma`.
--
-- Un disparador BEFORE INSERT sin SECURITY DEFINER sí corre como el rol que
-- inserta (GoTrue, `supabase_auth_admin`) y puede reescribir `NEW` antes de que la
-- fila se escriba. Además queda antes que el AFTER INSERT, así que `handle_new_user`
-- lee el rol ya sembrado y el perfil y el JWT coinciden por construcción en vez de
-- por dos reglas que puedan divergir.
--
-- ALCANCE DEL ARREGLO
-- -------------------
-- Solo rellena el hueco: si el claim no declara un rol válido, se escribe
-- `PATIENT`. No promueve a nadie. Un alta pública no puede obtener otro rol porque
-- `app_metadata` no es escribible por el cliente, y la promoción sigue siendo una
-- operación administrativa explícita (ver el README).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_business_role()
RETURNS trigger
LANGUAGE plpgsql
-- Sin SECURITY DEFINER a propósito: se ejecuta como el rol que inserta la fila.
SET search_path = public
AS $$
DECLARE
  declared text;
BEGIN
  declared := upper(coalesce(NEW.raw_app_meta_data ->> 'role', ''));

  -- Solo se interveniene el hueco. Un rol ya declarado (promoción, alta
  -- administrativa) se respeta tal cual.
  IF declared NOT IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN') THEN
    NEW.raw_app_meta_data := jsonb_set(
      coalesce(NEW.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"PATIENT"'::jsonb,
      true
    );
  END IF;

  RETURN NEW;
END
$$;

-- Relleno de las cuentas que ya existían sin rol en el claim, para que no queden
-- fuera del alcance del arreglo. `prisma` no puede escribir `auth.users`, así que
-- este UPDATE lo aplica el script de disparadores, que corre como `postgres`.
--
-- Se limita a las cuentas sin rol para no pisar una promoción ya hecha, y no toca
-- el perfil espejado: `handle_user_update` lo sincroniza a partir del claim.
--
--   UPDATE auth.users SET raw_app_meta_data = jsonb_set(...) ...
--   está en prisma/supabase/auth_user_triggers.sql
