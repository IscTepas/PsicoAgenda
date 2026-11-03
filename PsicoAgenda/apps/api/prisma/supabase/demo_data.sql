-- =============================================================================
-- Datos sintéticos del entorno aislado
-- (ticket 2026-10-28-aislar-previews-de-produccion).
--
-- EJECUTAR EN EL SQL EDITOR DEL DASHBOARD DE SUPABASE, como `postgres`, DESPUÉS
-- de `demo_accounts.sql` y de `grants.sql`.
--
-- QUÉ HACE
-- --------
-- Sobre las cuentas demo, crea datos suficientes para recorrer agenda,
-- expediente y reportes sin usar información de pacientes reales:
--
--   * horario de atención del psicólogo demo (lunes a viernes, 09:00–17:00);
--   * cuatro citas: completada, cancelada, no asistida y futura;
--   * honorarios de las citas (pagado y pendiente);
--   * expediente clínico con una entrada de bitácora;
--   * consentimiento informado firmado por el propio paciente.
--
-- Es idempotente: puede ejecutarse de nuevo sin duplicar filas. Las citas usan
-- identificadores fijos del espacio de demostración; el resto se inserta solo
-- si no existe para el paciente demo.
-- =============================================================================

SET search_path = public, extensions;

DO $$
DECLARE
  v_paciente_id   uuid;
  v_psicologo_id  uuid;
  v_expediente_id uuid;
  v_cita_hecha    constant uuid := 'a0000000-0000-4000-8000-000000000001';
  v_cita_cancelada constant uuid := 'a0000000-0000-4000-8000-000000000002';
  v_cita_no_asistio constant uuid := 'a0000000-0000-4000-8000-000000000003';
  v_cita_futura   constant uuid := 'a0000000-0000-4000-8000-000000000004';
  v_inicio_mes    timestamptz := date_trunc('month', now());
  v_hecha         timestamptz := v_inicio_mes + interval '1 day 9 hours';
  v_cancelada     timestamptz := v_inicio_mes + interval '2 days 11 hours';
  v_no_asistio    timestamptz := v_inicio_mes + interval '3 days 15 hours';
  v_futura        timestamptz := date_trunc('day', now() + interval '3 days') + interval '10 hours';
  v_dia           int;
BEGIN
  SELECT p.id INTO v_paciente_id
    FROM public.pacientes p
    JOIN public.usuarios u ON u.id = p.usuario_id
   WHERE u.correo = 'paciente.demo@example.com';

  SELECT ps.id INTO v_psicologo_id
    FROM public.psicologos ps
    JOIN public.usuarios u ON u.id = ps.usuario_id
   WHERE u.correo = 'psicologo.demo@example.com';

  IF v_paciente_id IS NULL OR v_psicologo_id IS NULL THEN
    RAISE EXCEPTION 'Faltan las cuentas demo: ejecuta demo_accounts.sql antes que este archivo.';
  END IF;

  -- Horario de atención (lunes = 1 … domingo = 7).
  FOR v_dia IN 1..5 LOOP
    INSERT INTO public.horarios_psicologo (
      id, psicologo_id, dia_semana, hora_inicio, hora_fin, activo
    )
    VALUES (
      gen_random_uuid(), v_psicologo_id, v_dia::smallint, '09:00', '17:00', true
    )
    ON CONFLICT (psicologo_id, dia_semana, hora_inicio) DO NOTHING;
  END LOOP;

  -- Citas de demostración. `fin - inicio` debe quedar entre 45 y 60 minutos.
  INSERT INTO public.citas (
    id, psicologo_id, paciente_id, inicio, fin, estado, modalidad,
    tipo_sesion, motivo, precio, motivo_cancelacion, cancelada_en,
    creado_en, actualizado_en
  )
  VALUES
    (
      v_cita_hecha, v_psicologo_id, v_paciente_id,
      v_hecha, v_hecha + interval '50 minutes',
      'COMPLETADA', 'PRESENCIAL', 'INDIVIDUAL',
      'Sesión de seguimiento (demostración)', 500,
      NULL, NULL, now(), now()
    ),
    (
      v_cita_cancelada, v_psicologo_id, v_paciente_id,
      v_cancelada, v_cancelada + interval '50 minutes',
      'CANCELADA', 'VIRTUAL', 'INDIVIDUAL',
      'Sesión cancelada (demostración)', 500,
      'Reprogramación solicitada por el paciente', v_cancelada - interval '1 day',
      now(), now()
    ),
    (
      v_cita_no_asistio, v_psicologo_id, v_paciente_id,
      v_no_asistio, v_no_asistio + interval '50 minutes',
      'NO_ASISTIO', 'PRESENCIAL', 'CONSULTA_INICIAL',
      'Primera consulta (demostración)', 500,
      NULL, NULL, now(), now()
    ),
    (
      v_cita_futura, v_psicologo_id, v_paciente_id,
      v_futura, v_futura + interval '50 minutes',
      'CONFIRMADA', 'VIRTUAL', 'INDIVIDUAL',
      'Próxima sesión (demostración)', 500,
      NULL, NULL, now(), now()
    )
  ON CONFLICT (id) DO NOTHING;

  -- Honorarios: la sesión completada queda pagada y la futura pendiente.
  INSERT INTO public.pagos_honorarios (
    id, cita_id, monto, estado, pagado_en, creado_en, actualizado_en
  )
  SELECT gen_random_uuid(), v_cita_hecha, 500.00, 'PAGADO',
         v_hecha + interval '50 minutes', now(), now()
   WHERE NOT EXISTS (
     SELECT 1 FROM public.pagos_honorarios WHERE cita_id = v_cita_hecha
   );

  INSERT INTO public.pagos_honorarios (
    id, cita_id, monto, estado, pagado_en, creado_en, actualizado_en
  )
  SELECT gen_random_uuid(), v_cita_futura, 500.00, 'PENDIENTE',
         NULL, now(), now()
   WHERE NOT EXISTS (
     SELECT 1 FROM public.pagos_honorarios WHERE cita_id = v_cita_futura
   );

  -- Expediente clínico del paciente demo.
  INSERT INTO public.expedientes_clinicos (
    id, paciente_id, abierto_en, motivo_consulta, antecedentes, diagnostico,
    observaciones_generales, estado, conservar_hasta, actualizado_en
  )
  VALUES (
    gen_random_uuid(),
    v_paciente_id,
    v_inicio_mes - interval '6 months',
    'Ansiedad y dificultades para dormir (datos sintéticos).',
    'Sin antecedentes médicos relevantes (datos sintéticos).',
    'Trastorno de ansiedad generalizada (caso de demostración).',
    'Paciente de demostración para recorrer el expediente sin datos reales.',
    'ACTIVO',
    ((v_inicio_mes - interval '6 months')::date + interval '5 years')::date,
    now()
  )
  ON CONFLICT (paciente_id) DO NOTHING;

  SELECT id INTO v_expediente_id
    FROM public.expedientes_clinicos
   WHERE paciente_id = v_paciente_id;

  -- Entrada de bitácora ligada a la sesión completada.
  INSERT INTO public.entradas_bitacora (
    id, expediente_id, cita_id, psicologo_id, fecha_sesion, notas_sesion,
    objetivos_trabajados, plan_proxima_sesion, estado_general, progreso,
    version, creado_en, actualizado_en
  )
  SELECT
    gen_random_uuid(), v_expediente_id, v_cita_hecha, v_psicologo_id,
    v_hecha,
    'Sesión de demostración: se trabajó respiración diafragmática y registro de pensamientos.',
    'Identificar detonantes de ansiedad y practicar una rutina de sueño.',
    'Continuar el registro de pensamientos durante la semana.',
    'Estable, con ansiedad moderada al inicio de la sesión.',
    'Avance parcial.',
    1, now(), now()
   WHERE NOT EXISTS (
     SELECT 1 FROM public.entradas_bitacora WHERE cita_id = v_cita_hecha
   );

  -- Consentimiento firmado por el propio paciente (sin tutor).
  INSERT INTO public.consentimientos_informados (
    id, paciente_id, firmado_en, documento, documento_url, tutor_legal_id,
    estado, retirado_en, creado_en
  )
  SELECT
    gen_random_uuid(), v_paciente_id,
    v_inicio_mes - interval '6 months',
    'Consentimiento informado (demostración)',
    NULL, NULL, 'FIRMADO', NULL, now()
   WHERE NOT EXISTS (
     SELECT 1 FROM public.consentimientos_informados
      WHERE paciente_id = v_paciente_id
        AND documento = 'Consentimiento informado (demostración)'
   );

  RAISE NOTICE 'Datos sintéticos listos para el paciente demo.';
END
$$;

-- =============================================================================
-- Verificación posterior
--
--   SELECT count(*) AS citas FROM public.citas c
--     JOIN public.pacientes p ON p.id = c.paciente_id
--     JOIN public.usuarios u ON u.id = p.usuario_id
--    WHERE u.correo = 'paciente.demo@example.com';
--     -- esperado: 4
--
--   SELECT count(*) AS expedientes FROM public.expedientes_clinicos e
--     JOIN public.pacientes p ON p.id = e.paciente_id
--     JOIN public.usuarios u ON u.id = p.usuario_id
--    WHERE u.correo = 'paciente.demo@example.com';
--     -- esperado: 1
--
--   SELECT count(*) AS entradas FROM public.entradas_bitacora b
--     JOIN public.expedientes_clinicos e ON e.id = b.expediente_id
--     JOIN public.pacientes p ON p.id = e.paciente_id
--     JOIN public.usuarios u ON u.id = p.usuario_id
--    WHERE u.correo = 'paciente.demo@example.com';
--     -- esperado: 1
-- =============================================================================
