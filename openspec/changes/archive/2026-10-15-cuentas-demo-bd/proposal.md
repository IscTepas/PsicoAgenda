# Proposal: Cuenta demo de paciente en la base de datos

## Contexto

La web expone un acceso de demostración de un clic en la pantalla de login (`apps/web/src/app/login/login-form.tsx`), alimentado por `NEXT_PUBLIC_DEMO_ACCOUNTS` (parseado en `apps/web/src/lib/demo-accounts.ts`). El acceso usa `supabase.auth.signInWithPassword`, por lo que cada cuenta demo debe existir en `auth.users` con la contraseña correcta, el correo confirmado y el *claim* de rol adecuado.

Hoy la cuenta demo de **psicólogo** (`psicologo.demo@example.com`) existe y funciona, pero la de **paciente** (`paciente.demo@example.com` / `123456`) no está dada de alta en la base de datos, así que el botón de demostración de paciente falla al iniciar sesión.

## Objetivo

Dar de alta (o asegurar, de forma idempotente) la cuenta demo de paciente en la base de datos de Supabase, de modo que el acceso de demostración de paciente funcione y existan las filas correspondientes en `public.usuarios` (rol `PACIENTE`) y `public.pacientes`.

## Alcance

- Nuevo script SQL idempotente `apps/api/prisma/supabase/demo_accounts.sql` que crea/asegura en `auth.users` y `auth.identities` al usuario `paciente.demo@example.com`.
- El perfil (`public.usuarios`, `public.pacientes`) lo crean los disparadores `on_auth_user_created` → `handle_new_user`; el script incluye un respaldo por si los disparadores no estuvieran instalados.
- Documentación OpenSpec del cambio y espejo en Obsidian.

## Out of scope / Non-goals

- No se modifica `schema.prisma` ni se añaden migraciones.
- No se toca la cuenta demo de psicólogo (ya funciona).
- No se cambia el código de la web ni de la API.
- No se reescriben las specs del proyecto (`skip_specs: true`).

## Impacto esperado

- El botón de acceso demo de paciente inicia sesión correctamente en desarrollo.
- Existe una fila en `public.usuarios` con rol `PACIENTE` y una fila en `public.pacientes` para `paciente.demo@example.com`.
- El script es re-ejecutable sin efectos adversos (no duplica filas).

## Riesgos y deuda técnica conocida

- El script debe ejecutarse como `postgres` (SQL Editor del dashboard o Management API): el rol de aplicación `prisma` no puede escribir `auth.users` ni `auth.identities`. Se documenta el procedimiento y la verificación posterior.
- La contraseña demo (`123456`) es débil y de solo 6 caracteres; es aceptable únicamente porque se trata de una cuenta de demostración y el *login* no aplica el esquema estricto de contraseñas.
- La trazabilidad futura de las cuentas demo depende de este script versionado (sustituye al inexistente `.env.credenciales` referido en `grants.sql`).
