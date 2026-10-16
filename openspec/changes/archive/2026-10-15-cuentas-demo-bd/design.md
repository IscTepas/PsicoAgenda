# Design: Cuenta demo de paciente en la base de datos

## Contexto técnico

- Los usuarios viven en `auth.users` (propiedad de `supabase_auth_admin`); el perfil `public.usuarios` se mantiene con el disparador `AFTER INSERT ON auth.users` → `public.handle_new_user()`, y `public.pacientes` también lo crea esa función (migración `20261015000000_paciente_al_registrar`).
- El *claim* de negocio vive en `auth.users.raw_app_meta_data.role` (valores en inglés `PATIENT`/`PSYCHOLOGIST`/`ADMIN`). El disparador `BEFORE INSERT` `public.seed_business_role()` rellena `PATIENT` cuando no se declara rol.
- Los datos clínicos viajan en `auth.users.raw_user_meta_data` (`name`, `birth_date`, `gender`, `address`, `emergency_contact`, `guardian`).
- El rol de aplicación `prisma` (única credencial de base de datos en `.env`) **no** puede escribir `auth.users`/`auth.identities`. Por eso este DDL/DML se aplica aparte, como `postgres` (mismo motivo documentado en `auth_user_triggers.sql` y `backfill_pacientes.sql`).

## Decisions

1. **El alta se hace directamente sobre `auth.users` + `auth.identities`, en un script SQL idempotente aplicado como `postgres`.**
   - Alternativas descartadas: el flujo `/registro` envía correo de confirmación (el *login* demo fallaría); la Admin API requiere una `service_role` que no está disponible; el alta manual desde el dashboard no es reproducible ni versionable.

2. **El perfil se delega a los disparadores, con respaldo defensivo.**
   - Tras el alta en `auth.*`, el script asegura `public.usuarios` (`ON CONFLICT (id) DO NOTHING`) y `public.pacientes` (`WHERE NOT EXISTS (usuario_id)`) para que el resultado sea correcto incluso si los disparadores no estuvieran instalados. Con los disparadores activos, estas sentencias son no-ops.

3. **Contraseña fijada con `crypt('123456', gen_salt('bf'))`.**
   - Es el formato que GoTrue espera (bcrypt) y permite que `signInWithPassword` valide la contraseña demo.

4. **Idempotencia por búsqueda por correo.**
   - Si el usuario no existe, se inserta; si existe, se asegura contraseña, confirmación de correo y *claim* `PATIENT` sin degradar un rol distinto ya asignado.

5. **Metadatos mínimos.**
   - Solo `name` para el paciente demo, tal como se decidió; `public.pacientes` queda con campos clínicos en `NULL` (el CHECK `ck_pacientes_menor_con_tutor` lo permite porque `fecha_nacimiento IS NULL`).

## Comportamiento del script

`apps/api/prisma/supabase/demo_accounts.sql` (un bloque `DO $$`):

1. Buscar `auth.users.id` por `email = 'paciente.demo@example.com'`.
2. Si no existe:
   - `INSERT INTO auth.users (...)` con `instance_id` cero, `aud/role = 'authenticated'`, `encrypted_password = crypt('123456', gen_salt('bf'))`, `email_confirmed_at = now()`, `raw_app_meta_data = {"provider":"email","providers":["email"],"role":"PATIENT"}`, `raw_user_meta_data = {"name":"Paciente Demo"}`, timestamps `now()`.
   - `INSERT INTO auth.identities (...)` con `provider = 'email'`, `provider_id = <uuid>` e `identity_data = {"sub":"<uuid>","email":"paciente.demo@example.com"}`.
3. Si existe:
   - `UPDATE auth.users` para fijar contraseña, confirmar correo si faltaba y asegurar el *claim* `PATIENT` (sin pisar `PSYCHOLOGIST`/`ADMIN`).
   - Asegurar la identidad de email si faltara.
4. Asegurar `public.usuarios` (rol `PACIENTE`, nombre, `zona_horaria = 'UTC'`) y `public.pacientes` (`ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`).
5. Consultas de verificación comentadas al final.

## Cómo se aplica

1. Supabase Dashboard → SQL Editor (ejecuta como `postgres`) → pegar y ejecutar `demo_accounts.sql`.
2. Verificar: iniciar sesión como `paciente.demo@example.com` / `123456`; y `SELECT ... FROM public.usuarios / public.pacientes`.

## Validation

- `openspec validate 2026-10-15-cuentas-demo-bd`
- (Manual, tras ejecutar en Supabase) login demo de paciente + filas en `public.usuarios`/`public.pacientes`.
