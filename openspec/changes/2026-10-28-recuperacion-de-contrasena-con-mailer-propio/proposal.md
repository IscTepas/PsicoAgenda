# Proposal

## Why

La recuperación de contraseña sigue delegada al SMTP por defecto de Supabase, limitado a dos correos por hora y sin control de remitente. El registro ya migró al mailer propio por ese mismo motivo, así que hoy conviven dos caminos: uno funciona y el otro deja al usuario esperando una hora o sin correo. Un usuario que olvida su contraseña no puede entrar, y el sistema no le ofrece una alternativa.

## What Changes

- La API SHALL emitir el enlace de recuperación con el mailer propio de la aplicación, igual que el código de registro.
- El token SHALL ser de un solo uso, con caducidad corta y almacenado únicamente como huella criptográfica.
- La solicitud SHALL responder de forma uniforme exista o no la cuenta, para no revelar qué correos están registrados.
- SHALL existir límite de solicitudes por correo y por origen.
- La pantalla de recuperación SHALL dejar de invocar `supabase.auth.resetPasswordForEmail`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `user-management`: el requisito «Recuperación de contraseña» pasa de un enlace emitido por el proveedor de identidad a un token de un solo uso emitido por la API con el mailer propio, con respuesta uniforme y límites de solicitud.

## Impact

- `apps/api`: nuevo servicio de recuperación, rutas, plantilla de correo y reutilización del almacén temporal existente.
- `apps/web`: pantallas `recuperar` y `recuperar/nueva`.
- Almacenamiento de tokens (huella y caducidad); sin cambios en el esquema de negocio si se reutiliza la tabla de cache.
- `apps/api/.env.example` y README: la recuperación deja de depender del SMTP de Supabase.
