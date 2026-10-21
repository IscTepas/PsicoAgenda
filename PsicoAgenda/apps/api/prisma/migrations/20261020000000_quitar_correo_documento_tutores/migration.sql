-- =============================================================================
-- Quitar `correo` y `documento_identidad` de public.tutores.
--
-- Se puede aplicar de las dos formas:
--
--   1. `npx prisma migrate deploy`: ya se ejecuta como el rol `prisma`, dueño
--      de la función y de las tablas; los bloques de rol no hacen nada.
--   2. Pegada en el SQL Editor de Supabase: el editor corre como `postgres`,
--      que NO es dueño y falla con `42501: must be owner of function
--      handle_new_user`. Por eso se le da membresía temporal sobre `prisma` y
--      se cambia de rol durante el script; al final se revierte.
-- =============================================================================

-- Cambio de rol solo si hace falta (no-op cuando ya corre como prisma).
DO $$
BEGIN
IF current_user <> 'prisma' THEN
  EXECUTE format('GRANT prisma TO %I', current_user);
END IF;
END
$$;

SET ROLE prisma;

-- Si alguna fila tuviera datos, la migración aborta en vez de borrarlos en
-- silencio: revisar/backup antes de volver a intentarlo.
DO $$
BEGIN
IF EXISTS (
  SELECT 1 FROM public.tutores
    WHERE correo IS NOT NULL OR documento_identidad IS NOT NULL
) THEN
  RAISE EXCEPTION
    'Hay tutores con correo o documento de identidad; revisar antes de quitar las columnas';
END IF;
END
$$;

-- La función del trigger insertaba esas dos columnas: se reemplaza antes del
-- DROP para que el registro de menores siga funcionando.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
declared_role text;
resolved_role public.rol_usuario;
v_patient_id  uuid;
v_guardian_id uuid;
BEGIN
-- El rol de negocio viaja en app_metadata, que el cliente no puede modificar.
declared_role := upper(coalesce(new.raw_app_meta_data ->> 'role', ''));

resolved_role := CASE
  WHEN declared_role = 'PSYCHOLOGIST' THEN 'PSICOLOGO'::rol_usuario
  WHEN declared_role = 'ADMIN'        THEN 'ADMINISTRADOR'::rol_usuario
  ELSE 'PACIENTE'::rol_usuario
END;

INSERT INTO public.usuarios (
  id, correo, nombre_completo, telefono, rol, activo, zona_horaria,
  notificar_whatsapp, notificar_correo, ultimo_acceso, creado_en, actualizado_en
)
VALUES (
  new.id,
  new.email,
  coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
  new.raw_user_meta_data ->> 'phone',
  resolved_role,
  (new.banned_until IS NULL OR new.banned_until < now()),
  coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
  false,
  true,
  new.last_sign_in_at,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

IF resolved_role = 'PACIENTE'::rol_usuario THEN
  BEGIN
    -- El tutor legal es requisito del CHECK cuando el paciente es menor.
    IF new.raw_user_meta_data -> 'guardian' IS NOT NULL
        AND nullif(new.raw_user_meta_data -> 'guardian' ->> 'name', '') IS NOT NULL THEN
      v_guardian_id := gen_random_uuid();

      INSERT INTO public.tutores (
        id, nombre_completo, telefono, parentesco
      )
      VALUES (
        v_guardian_id,
        new.raw_user_meta_data -> 'guardian' ->> 'name',
        new.raw_user_meta_data -> 'guardian' ->> 'phone',
        new.raw_user_meta_data -> 'guardian' ->> 'relationship'
      );
    END IF;

    INSERT INTO public.pacientes (
      id, usuario_id, fecha_nacimiento, sexo, direccion, tutor_legal_id, psicologo_id
    )
    VALUES (
      gen_random_uuid(),
      new.id,
      nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
      new.raw_user_meta_data ->> 'gender',
      new.raw_user_meta_data ->> 'address',
      v_guardian_id,
      NULL
    )
    ON CONFLICT (usuario_id) DO NOTHING
    RETURNING id INTO v_patient_id;

    -- `v_patient_id` queda NULL si el paciente ya existía (conflicto): no se
    -- duplica el contacto de emergencia.
    IF v_patient_id IS NOT NULL
        AND new.raw_user_meta_data -> 'emergency_contact' IS NOT NULL
        AND nullif(new.raw_user_meta_data -> 'emergency_contact' ->> 'name', '') IS NOT NULL THEN
      INSERT INTO public.contactos_emergencia (
        id, paciente_id, nombre_completo, telefono, parentesco, es_principal
      )
      VALUES (
        gen_random_uuid(),
        v_patient_id,
        new.raw_user_meta_data -> 'emergency_contact' ->> 'name',
        coalesce(new.raw_user_meta_data -> 'emergency_contact' ->> 'phone', ''),
        new.raw_user_meta_data -> 'emergency_contact' ->> 'relationship',
        true
      );
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'handle_new_user: no se pudo crear el expediente del paciente % (%)',
      new.id, SQLERRM;
  END;
END IF;

RETURN new;
END
$$;

ALTER TABLE "tutores" DROP COLUMN "correo";
ALTER TABLE "tutores" DROP COLUMN "documento_identidad";

-- Vuelve al rol original y retira la membresía temporal (solo si se cambió).
DO $$
BEGIN
IF session_user <> 'prisma' THEN
  EXECUTE 'RESET ROLE';
  EXECUTE format('REVOKE prisma FROM %I', session_user);
END IF;
END
$$;
