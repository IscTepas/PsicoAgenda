-- Tutoría con identidad y co-tutela (tickets 2026-10-28-tutoria-con-identidad-y-co-tutela
-- y 2026-10-28-mayoria-de-edad-y-fin-de-tutela).
--
-- `tutores` pasa a ser la persona (con cuenta opcional) y `pacientes_tutores` el
-- vínculo, de muchos a muchos y con un solo principal por paciente. El orden es el
-- del diseño: crear, copiar cada `tutor_legal_id` como vínculo principal y solo
-- después eliminar la columna. `consentimientos_informados.tutor_legal_id` no se
-- toca: sigue apuntando a la persona que firmó.

-- 1. La persona tutora puede ser un usuario existente.
ALTER TABLE tutores ADD COLUMN IF NOT EXISTS usuario_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS tutores_usuario_id_key ON tutores (usuario_id);
ALTER TABLE tutores DROP CONSTRAINT IF EXISTS tutores_usuario_id_fkey;
ALTER TABLE tutores ADD CONSTRAINT tutores_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. El vínculo.
CREATE TABLE IF NOT EXISTS pacientes_tutores (
  paciente_id  UUID NOT NULL,
  tutor_id     UUID NOT NULL,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  creado_en    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pacientes_tutores_pkey PRIMARY KEY (paciente_id, tutor_id),
  CONSTRAINT pacientes_tutores_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES pacientes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT pacientes_tutores_tutor_id_fkey
    FOREIGN KEY (tutor_id) REFERENCES tutores (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS pacientes_tutores_tutor_id_idx ON pacientes_tutores (tutor_id);
-- Mismo patrón que `contactos_emergencia`: la regla del principal vive en la base.
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_tutores_un_principal
  ON pacientes_tutores (paciente_id) WHERE es_principal;

-- 3. Copia: cada tutor actual queda como principal de su paciente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'tutor_legal_id'
  ) THEN
    INSERT INTO pacientes_tutores (paciente_id, tutor_id, es_principal)
    SELECT id, tutor_legal_id, true FROM pacientes WHERE tutor_legal_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

-- 4. La vista expone el tutor principal con el mismo nombre de columna.
DROP VIEW IF EXISTS vw_pacientes;
CREATE VIEW vw_pacientes AS
 SELECT p.id AS paciente_id,
    u.nombre_completo,
    u.correo,
    u.telefono,
    p.psicologo_id,
    p.fecha_nacimiento,
    (date_part('year'::text, age((CURRENT_DATE)::timestamp with time zone, (p.fecha_nacimiento)::timestamp with time zone)))::integer AS edad,
    COALESCE((p.fecha_nacimiento > (CURRENT_DATE - '18 years'::interval)), false) AS es_menor,
    pt.tutor_id AS tutor_legal_id
   FROM pacientes p
     JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN pacientes_tutores pt ON pt.paciente_id = p.id AND pt.es_principal;

-- 5. Recién ahora se retira la columna. El CHECK «menor con tutor» no puede mirar
-- otra tabla: la regla pasa al registro (zod) y a la API de tutores.
ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS ck_pacientes_menor_con_tutor;
ALTER TABLE pacientes DROP COLUMN IF EXISTS tutor_legal_id;

-- 6. Quién pidió la solicitud (el propio paciente o su tutor).
ALTER TABLE solicitudes_cita ADD COLUMN IF NOT EXISTS solicitante_id UUID;
ALTER TABLE solicitudes_cita DROP CONSTRAINT IF EXISTS solicitudes_cita_solicitante_id_fkey;
ALTER TABLE solicitudes_cita ADD CONSTRAINT solicitudes_cita_solicitante_id_fkey
  FOREIGN KEY (solicitante_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Sin fecha de nacimiento la mayoría de edad nunca llegaría y el tutor quedaría
-- para siempre: no hay vínculo sin fecha, ni se borra la fecha con vínculos.
CREATE OR REPLACE FUNCTION public.tutela_exige_fecha_nacimiento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'pacientes_tutores' THEN
    IF (SELECT fecha_nacimiento FROM public.pacientes WHERE id = new.paciente_id) IS NULL THEN
      RAISE EXCEPTION 'tutela_sin_fecha_nacimiento' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF new.fecha_nacimiento IS NULL
        AND EXISTS (SELECT 1 FROM public.pacientes_tutores WHERE paciente_id = new.id) THEN
    RAISE EXCEPTION 'tutela_sin_fecha_nacimiento' USING ERRCODE = 'check_violation';
  END IF;
  RETURN new;
END
$$;

DROP TRIGGER IF EXISTS tutela_exige_fecha ON pacientes_tutores;
CREATE TRIGGER tutela_exige_fecha BEFORE INSERT OR UPDATE ON pacientes_tutores
  FOR EACH ROW EXECUTE FUNCTION public.tutela_exige_fecha_nacimiento();
DROP TRIGGER IF EXISTS tutela_exige_fecha ON pacientes;
CREATE TRIGGER tutela_exige_fecha BEFORE UPDATE OF fecha_nacimiento ON pacientes
  FOR EACH ROW EXECUTE FUNCTION public.tutela_exige_fecha_nacimiento();

-- 8. El alta liga al tutor por la tabla puente. Mismo cuerpo que la versión de
-- 20261026000000_asignar_psicologa_al_registrar salvo el vínculo.
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
      id, usuario_id, fecha_nacimiento, sexo, direccion, psicologo_id
    )
    VALUES (
      gen_random_uuid(),
      new.id,
      nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
      new.raw_user_meta_data ->> 'gender',
      new.raw_user_meta_data ->> 'address',
      CASE WHEN (SELECT count(*) FROM public.psicologos) = 1
           THEN (SELECT id FROM public.psicologos LIMIT 1)
      END
    )
    ON CONFLICT (usuario_id) DO NOTHING
    RETURNING id INTO v_patient_id;

    IF v_patient_id IS NOT NULL AND v_guardian_id IS NOT NULL THEN
      INSERT INTO public.pacientes_tutores (paciente_id, tutor_id, es_principal)
      VALUES (v_patient_id, v_guardian_id, true);
    END IF;

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
