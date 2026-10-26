-- El nombre y el teléfono se toman de Supabase Auth solo al crear la cuenta.
-- Después los edita el usuario desde su perfil en la app; antes, cada inicio de
-- sesión (que actualiza auth.users) los volvía a pisar con los metadatos de Auth.

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

  INSERT INTO public.usuarios (
    id, correo, nombre_completo, telefono, rol, activo, zona_horaria,
    notificar_whatsapp, notificar_correo, ultimo_acceso, creado_en, actualizado_en
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    CASE
      WHEN declared_role = 'PSYCHOLOGIST' THEN 'PSICOLOGO'::rol_usuario
      WHEN declared_role = 'ADMIN'        THEN 'ADMINISTRADOR'::rol_usuario
      ELSE 'PACIENTE'::rol_usuario
    END,
    (new.banned_until IS NULL OR new.banned_until < now()),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    false,
    true,
    new.last_sign_in_at,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET correo           = EXCLUDED.correo,
        -- nombre_completo y telefono NO se sincronizan: los administra el perfil.
        -- Si el claim no declara rol se conserva el ya establecido: la
        -- verificación de tokens falla cerrada ante un claim sin rol.
        rol              = CASE
                             WHEN declared_role IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN')
                               THEN EXCLUDED.rol
                             ELSE public.usuarios.rol
                           END,
        activo           = EXCLUDED.activo,
        ultimo_acceso    = EXCLUDED.ultimo_acceso,
        actualizado_en   = EXCLUDED.actualizado_en;

  RETURN new;
END
$$;
