-- =============================================================================
-- Cuentas de demostración (paciente y psicólogo) en la base de datos.
--
-- EJECUTAR EN EL SQL EDITOR DEL DASHBOARD DE SUPABASE, como `postgres`
-- (Dashboard -> SQL Editor -> New query -> Run). El script es idempotente:
-- puede ejecutarse de nuevo sin efectos secundarios ni filas duplicadas.
--
-- POR QUÉ NO VA EN UNA MIGRACIÓN
-- ------------------------------
-- `auth.users` y `auth.identities` son propiedad de `supabase_auth_admin`; el
-- rol de aplicación `prisma` (única credencial de base de datos en `.env`) no
-- puede escribir en ellas. El mismo motivo por el que viven aparte
-- `bootstrap.sql`, `auth_user_triggers.sql` y `backfill_pacientes.sql`.
--
-- QUÉ HACE
-- --------
-- Asegura las identidades que consume el acceso de demostración de la web
-- (NEXT_PUBLIC_DEMO_ACCOUNTS -> apps/web/src/lib/demo-accounts.ts). El acceso
-- usa `supabase.auth.signInWithPassword`, por lo que cada cuenta debe existir
-- en `auth.users` con el correo confirmado y el claim de rol correcto:
--
--   1. Paciente  `paciente.demo@example.com`  / `123456`  -> claim `PATIENT`
--      Perfil de negocio: `public.usuarios` (rol `PACIENTE`) + `public.pacientes`.
--   2. Psicólogo `psicologo.demo@example.com` / `123456`  -> claim `PSYCHOLOGIST`
--      Perfil de negocio: `public.usuarios` (rol `PSICOLOGO`) + `public.psicologos`.
--
-- El perfil del paciente lo crean además los disparadores
-- `on_auth_user_created` -> `handle_new_user` (ver auth_user_triggers.sql).
-- El de psicólogo NO lo crea ningún disparador: por eso este script lo asegura
-- explícitamente. Sin esa fila, toda ruta de negocio responde `403 Forbidden`
-- ("La cuenta no tiene perfil de psicólogo").
--
-- Al final se vincula el paciente demo con el psicólogo demo
-- (`public.pacientes.psicologo_id`) para que la vista del paciente tenga
-- terapeuta asignado.
--
-- PRERREQUISITO
-- -------------
-- Si los objetos de `public` los creó el rol `prisma`, `postgres` necesita los
-- privilegios de `grants.sql` para poder escribir en `public.usuarios`,
-- `public.pacientes` y `public.psicologos` (si no, `permission denied`).
--
-- Verificación posterior (comentada al final del archivo).
-- =============================================================================

-- `crypt`/`gen_salt` viven en el esquema `extensions` de Supabase.
SET search_path = public, extensions;

DO $$
DECLARE
  demo_email    constant text := 'paciente.demo@example.com';
  demo_password constant text := '123456';
  demo_name     constant text := 'Paciente Demo';
  v_user_id     uuid;
  v_claim       text;
BEGIN
  SELECT au.id, upper(coalesce(au.raw_app_meta_data ->> 'role', ''))
    INTO v_user_id, v_claim
    FROM auth.users au
   WHERE au.email = demo_email;

  IF v_user_id IS NULL THEN
    -- Alta nueva: se crea la identidad. El trigger BEFORE INSERT
    -- `seed_business_role` respeta el claim `role` ya declarado aquí.
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      demo_email,
      crypt(demo_password, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', 'PATIENT'
      ),
      jsonb_build_object(
        'name', demo_name,
        'emergency_contact', jsonb_build_object(
          'name', 'Contacto Demo',
          'phone', '555-000-0000',
          'relationship', 'Familiar'
        )
      )
    );

    INSERT INTO auth.identities (
      user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', demo_email,
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );

    RAISE NOTICE 'Cuenta demo de paciente creada (%).', demo_email;
  ELSE
    -- Ya existe: se asegura contraseña, confirmación de correo y claim, sin
    -- degradar un rol distinto ya asignado (p. ej. una promoción a psicólogo).
    UPDATE auth.users
       SET encrypted_password = crypt(demo_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb)
                                || jsonb_build_object(
                                     'provider', 'email',
                                     'providers', jsonb_build_array('email'),
                                     'role', CASE
                                               WHEN v_claim IN ('PSYCHOLOGIST', 'ADMIN')
                                                 THEN v_claim
                                               ELSE 'PATIENT'
                                             END
                                   ),
           updated_at = now()
     WHERE id = v_user_id;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities
       WHERE user_id = v_user_id AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      )
      VALUES (
        v_user_id,
        v_user_id::text,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', demo_email,
          'email_verified', true
        ),
        'email',
        now(), now(), now()
      );
    END IF;

    RAISE NOTICE 'Cuenta demo de paciente asegurada (%).', demo_email;
  END IF;

  -- Respaldo de negocio: no-ops si los disparadores ya crearon el perfil.
  INSERT INTO public.usuarios (
    id, correo, nombre_completo, telefono, rol, activo, zona_horaria,
    notificar_whatsapp, notificar_correo, ultimo_acceso, creado_en, actualizado_en
  )
  VALUES (
    v_user_id,
    demo_email,
    demo_name,
    NULL,
    'PACIENTE'::rol_usuario,
    true,
    'UTC',
    false,
    true,
    NULL,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.pacientes (
    id, usuario_id, fecha_nacimiento, sexo, direccion, psicologo_id
  )
  SELECT gen_random_uuid(), v_user_id, NULL, NULL, NULL, NULL
   WHERE NOT EXISTS (
     SELECT 1 FROM public.pacientes p WHERE p.usuario_id = v_user_id
   );

  -- Contacto de emergencia de demostración. Idempotente: si el paciente demo ya
  -- existe (el trigger no vuelve a correr al actualizar la metadata), esto
  -- asegura la fila que hoy muestra vacía la ficha clínica.
  INSERT INTO public.contactos_emergencia (
    id, paciente_id, nombre_completo, telefono, parentesco, es_principal
  )
  SELECT gen_random_uuid(), p.id, 'Contacto Demo', '555-000-0000', 'Familiar', true
    FROM public.pacientes p
   WHERE p.usuario_id = v_user_id
     AND NOT EXISTS (
           SELECT 1 FROM public.contactos_emergencia c
            WHERE c.paciente_id = p.id AND c.es_principal
         );
END
$$;

-- -----------------------------------------------------------------------------
-- Cuenta demo de psicólogo.
--
-- La fila en `public.psicologos` no la crea ningún disparador; es la que exige
-- `requirePsychologistId` en la API. Su ausencia provoca el `403` en rutas como
-- `GET /api/appointments`.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  demo_email    constant text := 'psicologo.demo@example.com';
  demo_password constant text := '123456';
  demo_name     constant text := 'Psicólogo Demo';
  demo_license  constant text := 'DEMO-PSIC-0001';
  demo_specialty constant text := 'Psicología clínica';
  v_user_id     uuid;
  v_claim       text;
  v_psych_id    uuid;
BEGIN
  SELECT au.id, upper(coalesce(au.raw_app_meta_data ->> 'role', ''))
    INTO v_user_id, v_claim
    FROM auth.users au
   WHERE au.email = demo_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      demo_email,
      crypt(demo_password, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', 'PSYCHOLOGIST'
      ),
      jsonb_build_object('name', demo_name)
    );

    INSERT INTO auth.identities (
      user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', demo_email,
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );

    RAISE NOTICE 'Cuenta demo de psicólogo creada (%).', demo_email;
  ELSE
    -- Ya existe: se asegura contraseña, confirmación y claim de psicólogo, sin
    -- degradar un `ADMIN` ya asignado.
    UPDATE auth.users
       SET encrypted_password = crypt(demo_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb)
                                || jsonb_build_object(
                                     'provider', 'email',
                                     'providers', jsonb_build_array('email'),
                                     'role', CASE
                                               WHEN v_claim = 'ADMIN'
                                                 THEN 'ADMIN'
                                               ELSE 'PSYCHOLOGIST'
                                             END
                                   ),
           updated_at = now()
     WHERE id = v_user_id;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities
       WHERE user_id = v_user_id AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      )
      VALUES (
        v_user_id,
        v_user_id::text,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', demo_email,
          'email_verified', true
        ),
        'email',
        now(), now(), now()
      );
    END IF;

    RAISE NOTICE 'Cuenta demo de psicólogo asegurada (%).', demo_email;
  END IF;

  -- Respaldo de negocio: usuarios (rol PSICOLOGO) y el perfil de psicólogo.
  INSERT INTO public.usuarios (
    id, correo, nombre_completo, telefono, rol, activo, zona_horaria,
    notificar_whatsapp, notificar_correo, ultimo_acceso, creado_en, actualizado_en
  )
  VALUES (
    v_user_id,
    demo_email,
    demo_name,
    NULL,
    'PSICOLOGO'::rol_usuario,
    true,
    'UTC',
    false,
    true,
    NULL,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_psych_id FROM public.psicologos WHERE usuario_id = v_user_id;

  IF v_psych_id IS NULL THEN
    v_psych_id := gen_random_uuid();

    INSERT INTO public.psicologos (
      id, usuario_id, cedula_profesional, especialidad, anios_experiencia, biografia
    )
    VALUES (
      v_psych_id,
      v_user_id,
      demo_license,
      demo_specialty,
      8,
      'Psicóloga de demostración para el entorno de desarrollo.'
    )
    ON CONFLICT (usuario_id) DO NOTHING;
  END IF;

  -- Vincula el paciente demo con el psicólogo demo (solo si aún no tiene uno).
  UPDATE public.pacientes p
     SET psicologo_id = v_psych_id
   WHERE p.usuario_id = (
           SELECT id FROM auth.users WHERE email = 'paciente.demo@example.com'
         )
     AND p.psicologo_id IS NULL;
END
$$;

-- =============================================================================
-- Verificación posterior
--
--   SELECT email, email_confirmed_at, raw_app_meta_data ->> 'role' AS claim
--     FROM auth.users
--    WHERE email IN ('paciente.demo@example.com', 'psicologo.demo@example.com');
--     -- esperado: claim = PATIENT y PSYCHOLOGIST
--
--   SELECT id, correo, rol, activo FROM public.usuarios
--    WHERE correo IN ('paciente.demo@example.com', 'psicologo.demo@example.com');
--     -- esperado: rol = PACIENTE y PSICOLOGO, activo = true
--
--   SELECT p.id, u.correo FROM public.pacientes p
--     JOIN public.usuarios u ON u.id = p.usuario_id
--    WHERE u.correo = 'paciente.demo@example.com';
--     -- esperado: una fila
--
--   SELECT ps.id, u.correo, ps.cedula_profesional FROM public.psicologos ps
--     JOIN public.usuarios u ON u.id = ps.usuario_id
--    WHERE u.correo = 'psicologo.demo@example.com';
--     -- esperado: una fila (sin ella, la API responde 403)
--
--   SELECT ps.id AS psicologo_id FROM public.pacientes p
--     JOIN public.usuarios u ON u.id = p.usuario_id
--     JOIN public.psicologos ps ON ps.id = p.psicologo_id
--    WHERE u.correo = 'paciente.demo@example.com';
--     -- esperado: una fila (paciente vinculado al psicólogo demo)
--
-- Prueba funcional: en desarrollo, pulsar los accesos rápidos de "Paciente" y
-- "Psicólogo" (contraseña 123456) en la pantalla de login y comprobar que
-- `GET /api/appointments` responde 200.
-- =============================================================================
