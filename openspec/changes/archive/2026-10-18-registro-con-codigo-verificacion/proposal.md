# Proposal

## Why

Hoy el registro llama `supabase.auth.signUp` directamente desde el navegador: la cuenta se crea en `auth.users` y los triggers pueblan `usuarios`, `pacientes`, `tutores_legales` y `contactos_emergencia` **antes** de cualquier verificación del correo. La confirmación depende del enlace de Supabase con su SMTP por defecto, que solo envía a correos del equipo de la organización y con un límite de 2 correos/hora, por lo que no sirve para registrar usuarios reales en producción. Se necesita verificar el correo con un código de un solo uso generado por la propia aplicación, sin persistir ningún dato del solicitante en la base de datos hasta que el código se confirme.

## What Changes

- **BREAKING** (flujo de registro): `/registro` deja de llamar `supabase.auth.signUp` desde el navegador; el alta pasa a un flujo de dos pasos contra la API (`pre-registro` → `verificar-codigo`).
- Nuevos endpoints en la API: `POST /api/auth/pre-registro`, `POST /api/auth/verificar-codigo` y reenvío de código.
- La API genera un código de 6 dígitos, lo guarda **hasheado** en memoria del proceso con expiración de 10 minutos; la expiración es automática (sin cron, sin tablas temporales y sin servicios externos) y los datos del formulario viven solo en el cliente hasta la verificación.
- Envío del correo desde la API con Nodemailer y el SMTP de Gmail (contraseña de aplicación), con plantilla propia.
- La cuenta se crea recién con el código válido (`auth.admin.createUser` con correo ya confirmado); los triggers existentes crean el perfil en ese momento.
- Controles de abuso: máximo de intentos por código, cooldown de reenvío y rate limit por IP en `pre-registro`.
- Nuevas variables de entorno en `apps/api`: credenciales de Gmail y `SUPABASE_SERVICE_ROLE_KEY`.

## Capabilities

### New Capabilities

(no se introducen capacidades nuevas; la verificación pertenece al alta de usuarios)

### Modified Capabilities

- `user-management`: el requisito "Registro de usuarios" deja de delegar la verificación en el enlace de Supabase: ahora es un código de un solo uso con expiración de 10 minutos generado por la aplicación, y la cuenta (junto con su perfil) solo SHALL crearse después de verificarlo; los datos del formulario SHALL no persistirse antes de la verificación.

## Impact

- **apps/web**: `src/app/registro/register-form.tsx` (flujo en dos pasos con pantalla de código, reenvío con cooldown); variables `NEXT_PUBLIC_*` sin cambios.
- **apps/api**: nuevas rutas/servicios de registro y mailer; dependencia `nodemailer`; requiere `SUPABASE_SERVICE_ROLE_KEY` (antes no usaba la API la service role).
- **Entornos**: `.env.example` y README de `apps/api` (documentación del límite de 2 correos/hora del SMTP por defecto queda obsoleta para este flujo).
- **Sin cambios**: esquema Prisma (cero tablas nuevas), triggers de `auth.users`, `proxy.ts`, login, recuperación de contraseña y la API `/me`.
- **Specs**: delta sobre `openspec/specs/user-management/spec.md`.
