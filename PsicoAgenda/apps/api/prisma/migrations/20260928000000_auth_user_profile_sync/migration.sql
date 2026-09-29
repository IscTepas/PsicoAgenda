-- =============================================================================
-- Sincronización del perfil espejado `public.users` con la identidad del proveedor.
--
-- ESTA MIGRACIÓN SOLO DEFINE LAS FUNCIONES.
-- Los disparadores sobre `auth.users` están en
-- `prisma/supabase/auth_user_triggers.sql` y se aplican aparte, con un rol que
-- tenga privilegio TRIGGER sobre esa tabla (en Supabase, `postgres`).
--
-- Por qué la división: `auth.users` es propiedad de `supabase_auth_admin`. Crear un
-- disparador sobre ella exige USAGE del schema `auth` y privilegio TRIGGER sobre la
-- tabla, y el rol de aplicación `prisma` no puede adquirirlos (ni siquiera
-- delegándoselos). Incluir los CREATE TRIGGER aquí hace fallar `migrate deploy` con
-- `permission denied for schema auth`. Ampliar los privilegios de `prisma` sobre el
-- schema `auth` sería excesivo: le ampliaría el alcance sobre el proveedor de
-- identidad sin necesidad. Crear las funciones sí es viable con `prisma`, que es
-- dueño de las tablas que escriben, así que es lo que hace esta migración.
-- =============================================================================

-- `public.users` no es la fuente de verdad de identidad: sus `id` son los UUID de
-- `auth.users` y estos triggers (ver `auth_user_triggers.sql`) mantienen
-- sincronizados `email`, `name`, `role`, `is_active` y `last_login_at`.
--
-- Por qué no hay una FK a `auth.users`: `auth` pertenece al proveedor, que modifica
-- sus columnas para entregar nuevas funciones; referenciarlas desde Prisma genera
-- drift que `migrate dev` intentaría revertir.
--
-- Por qué el lenguaje de esquema de Prisma no las declara: no puede expresar
-- disparadores ni funciones de trigger, y declararlas en el datamodel produciría
-- desviación en cada `migrate dev`.
--
-- Las funciones son SECURITY DEFINER porque el disparador se ejecuta dentro de
-- GoTrue, es decir, como `supabase_auth_admin`, que no tiene permisos de escritura
-- sobre `public.users`. Como el dueño de cada función es el rol `prisma` que aplica
-- esta migración, se ejecutan con el menor privilegio posible.
--
-- ADVERTENCIA OPERATIVA: los cuerpos `$$` de aquí son seguros porque los aplica el
-- motor de migraciones. `@prisma/adapter-pg` implementa `executeScript` partiendo el
-- script por `;`, así que `prisma db execute` y el seed NO deben contener funciones
-- PL/pgSQL (este archivo no pasa por esas rutas).

-- --------------------------------------------------------------------------------
-- Función de alta: crea el perfil a partir de una identidad nueva.
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  declared_role text;
BEGIN
  -- El rol de negocio viaja en app_metadata, que el cliente no puede modificar.
  -- `user_metadata` es editable por el usuario y queda descartado a propósito.
  declared_role := upper(coalesce(new.raw_app_meta_data ->> 'role', ''));

  INSERT INTO public.users (
    id, email, name, role, is_active, last_login_at, created_at, updated_at
  )
  VALUES (
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    CASE
      WHEN declared_role IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN') THEN declared_role::"UserRole"
      ELSE 'PATIENT'::"UserRole"
    END,
    (new.banned_until IS NULL OR new.banned_until < now()),
    new.last_sign_in_at,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END
$$;

-- --------------------------------------------------------------------------------
-- Función de actualización: cambio de correo, bloqueo o reinstatement de la cuenta.
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  declared_role text;
BEGIN
  declared_role := upper(coalesce(new.raw_app_meta_data ->> 'role', ''));

  INSERT INTO public.users (
    id, email, name, role, is_active, last_login_at, created_at, updated_at
  )
  VALUES (
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    CASE
      WHEN declared_role IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN') THEN declared_role::"UserRole"
      ELSE 'PATIENT'::"UserRole"
    END,
    (new.banned_until IS NULL OR new.banned_until < now()),
    new.last_sign_in_at,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email         = EXCLUDED.email,
        name          = EXCLUDED.name,
        -- Si el claim no declara rol se conserva el ya establecido: la verificación
        -- de tokens falla cerrada ante una sesión sin rol, no degrada a paciente.
        role          = CASE
                           WHEN declared_role IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN')
                             THEN EXCLUDED.role
                           ELSE public.users.role
                         END,
        is_active     = EXCLUDED.is_active,
        last_login_at = EXCLUDED.last_login_at,
        updated_at    = EXCLUDED.updated_at;

  RETURN new;
END
$$;

-- --------------------------------------------------------------------------------
-- Función de baja: la identidad desaparece del proveedor.
--
-- El perfil NO se borra. Las relaciones del esquema (`User -> Patient ->
-- ClinicalRecord`, `User -> Psychologist -> LogEntry`) están en `onDelete: Cascade`,
-- así que borrar la fila arrastraría expedientes clínicos y bitácoras de sesión, y
-- el requirement "Retención de expedientes" exige conservarlos por el plazo legal
-- incluso si el paciente está inactivo.
--
-- La baja se materializa anonimizando el perfil y marcándolo inactivo: deja de ser
-- una usuaria habilitada sin destruir historia clínica. El borrado definitivo del
-- expediente, una vez vencido el plazo, es un flujo administrativo explícito.
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- `old.id`, no `new.id`: en un disparador AFTER DELETE la variable NEW es NULL
  -- (la fila eliminada vive en OLD), así que un `WHERE id = new.id` no casa con
  -- nada y la baja de cuentas se completaba sin anonimizar el perfil. Sin el
  -- `::text` tampoco funcionaba: `public.users.id` es `text` y `auth.users.id` es
  -- `uuid`, y PostgreSQL no define el operador `text = uuid`
  -- (`operator does not exist`), que rompía la baja con HTTP 500.
  --
  -- El alta nunca estuvo afectada porque en un AFTER INSERT NEW sí está poblado, y
  -- en el INSERT existe una conversión de asignación de uuid a text.
  UPDATE public.users
     SET email      = 'eliminado+' || replace(old.id::text, '-', '') || '@psicoagenda.invalid',
         phone      = NULL,
         is_active  = false,
         updated_at = now()
   WHERE id = old.id::text;

  RETURN old;
END
$$;

-- --------------------------------------------------------------------------------
-- Disparadores: ver `prisma/supabase/auth_user_triggers.sql`.
-- Se crean fuera de esta migración a propósito; el motivo está en la cabecera.
-- --------------------------------------------------------------------------------
