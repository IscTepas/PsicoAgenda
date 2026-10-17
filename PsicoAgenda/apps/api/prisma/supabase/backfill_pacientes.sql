-- =============================================================================
-- Backfill de expedientes para pacientes ya registrados.
--
-- CONTEXTO: hasta la migración `20261015000000_paciente_al_registrar`, el alta
-- creaba la fila de `public.usuarios` pero nunca la de `public.pacientes`. Los
-- datos clínicos (fecha de nacimiento, sexo, dirección, contacto de emergencia,
-- tutor legal) de esas cuentas viven SOLO en `auth.users.raw_user_meta_data`.
--
-- CÓMO EJECUTARLO
--   Una sola vez, DESPUÉS de `prisma migrate deploy`, como `postgres` en el
--   SQL Editor del dashboard de Supabase (o con la Management API).
--
-- POR QUÉ NO VA EN UNA MIGRACIÓN
--   Leer `auth.users` exige privilegios que el rol de aplicación `prisma` no
--   tiene (mismo motivo que `auth_user_triggers.sql`, que también se aplica
--   aparte). El script es idempotente: solo crea expedientes que falten.
-- =============================================================================

DO $$
DECLARE
  u             record;
  v_patient_id  uuid;
  v_guardian_id uuid;
BEGIN
  FOR u IN
    SELECT au.id,
           au.email,
           au.raw_user_meta_data AS meta
      FROM auth.users au
      JOIN public.usuarios us ON us.id = au.id
     WHERE us.rol = 'PACIENTE'::rol_usuario
       AND NOT EXISTS (
             SELECT 1 FROM public.pacientes p WHERE p.usuario_id = au.id
           )
  LOOP
    BEGIN
      v_guardian_id := NULL;

      IF u.meta -> 'guardian' IS NOT NULL
         AND nullif(u.meta -> 'guardian' ->> 'name', '') IS NOT NULL THEN
        v_guardian_id := gen_random_uuid();

        INSERT INTO public.tutores (
          id, nombre_completo, correo, telefono, parentesco, documento_identidad
        )
        VALUES (
          v_guardian_id,
          u.meta -> 'guardian' ->> 'name',
          NULL,
          u.meta -> 'guardian' ->> 'phone',
          u.meta -> 'guardian' ->> 'relationship',
          NULL
        );
      END IF;

      INSERT INTO public.pacientes (
        id, usuario_id, fecha_nacimiento, sexo, direccion, tutor_legal_id, psicologo_id
      )
      VALUES (
        gen_random_uuid(),
        u.id,
        nullif(u.meta ->> 'birth_date', '')::date,
        u.meta ->> 'gender',
        u.meta ->> 'address',
        v_guardian_id,
        NULL
      )
      ON CONFLICT (usuario_id) DO NOTHING
      RETURNING id INTO v_patient_id;

      IF v_patient_id IS NOT NULL
         AND u.meta -> 'emergency_contact' IS NOT NULL
         AND nullif(u.meta -> 'emergency_contact' ->> 'name', '') IS NOT NULL THEN
        INSERT INTO public.contactos_emergencia (
          id, paciente_id, nombre_completo, telefono, parentesco, es_principal
        )
        VALUES (
          gen_random_uuid(),
          v_patient_id,
          u.meta -> 'emergency_contact' ->> 'name',
          coalesce(u.meta -> 'emergency_contact' ->> 'phone', ''),
          u.meta -> 'emergency_contact' ->> 'relationship',
          true
        );
      END IF;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'backfill_pacientes: no se pudo crear el expediente del usuario % (%)',
        u.id, SQLERRM;
    END;
  END LOOP;
END
$$;

-- Verificación posterior: la vista une `pacientes` con `usuarios`; tras el
-- backfill debe listar a todos los pacientes registrados.
--   SELECT count(*) FROM public.pacientes;
--   SELECT * FROM public.vw_pacientes;
