-- Corrige `handle_user_delete` en bases donde la migración
-- `20260928000000_auth_user_profile_sync` ya se aplicó.
--
-- Dos fallos, ambos en la baja de cuentas y ninguno en el alta:
--
-- 1. `WHERE id = new.id` en lugar de `old.id`. En un disparador AFTER DELETE la
--    variable NEW es NULL (la fila eliminada vive en OLD), así que la condición
--    nunca casaba con nada: el borrado de la identidad devolvía HTTP 200 pero el
--    perfil se quedaba con el correo original y `is_active = true`, es decir, una
--    persona dada de baja conservaba su perfil activo.
--
-- 2. Faltaba el cast: `public.users.id` es `text` y `auth.users.id` es `uuid`, y
--    PostgreSQL no define el operador `text = uuid`. Con el cast ausente la baja
--    fallaba antes con `operator does not exist: text = uuid` (HTTP 500).
--
-- Por qué el alta nunca estuvo afectada: en un AFTER INSERT NEW sí está poblado, y
-- en el INSERT existe una conversión de asignación de uuid a text, de modo que
-- `handle_new_user` creaba el perfil correctamente.
--
-- `CREATE OR REPLACE FUNCTION` es idempotente: en una instalación donde la
-- migración anterior ya trae el cuerpo correcto, este archivo solo lo reescribe.

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
     SET email      = 'eliminado+' || replace(old.id::text, '-', '') || '@psicoagenda.invalid',
         phone      = NULL,
         is_active  = false,
         updated_at = now()
   WHERE id = old.id::text;

  RETURN old;
END
$$;
