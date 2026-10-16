-- =============================================================================
-- Expediente de paciente al registrarse.
--
-- PROBLEMA: `handle_new_user` (baseline_esquema_espanol) insertaba únicamente en
-- `public.usuarios`. Los datos clínicos que el formulario de `/registro` envía en
-- `options.data` viajaban en `auth.users.raw_user_meta_data`, pero nadie los leía:
-- todo paciente quedaba como fila de `usuarios` sin fila en `pacientes`.
--
-- SOLUCIÓN: al crear la identidad, si el rol resuelto es PACIENTE se crea también
-- el expediente: `pacientes` y, cuando vienen en los metadatos, `tutores_legales`
-- y `contactos_emergencia`.
--
-- Los metadatos que envía la web (apps/web/src/app/registro/register-form.tsx):
--   name, phone, role, birth_date, gender, address, is_minor,
--   emergency_contact { name, phone, relationship },
--   guardian { name, phone, relationship }   -- solo si is_minor
--
-- Se respeta `ck_pacientes_menor_con_tutor`: el tutor se inserta ANTES que el
-- paciente y por eso puede enlazarse en el mismo alta. El bloque de expediente
-- va envuelto en un manejador de excepciones para que un dato incoherente (por
-- ejemplo un menor sin tutor) no aborte la transacción entera de GoTrue y deje
-- al usuario sin poder registrarse; el fallo se registra como WARNING.
-- =============================================================================

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

        INSERT INTO public.tutores_legales (
          id, nombre_completo, correo, telefono, parentesco, documento_identidad
        )
        VALUES (
          v_guardian_id,
          new.raw_user_meta_data -> 'guardian' ->> 'name',
          NULL,
          new.raw_user_meta_data -> 'guardian' ->> 'phone',
          new.raw_user_meta_data -> 'guardian' ->> 'relationship',
          NULL
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
