# Design

## Context

Ver proposal.md (Why). En resumen técnico: el alta actual ocurre íntegramente en el navegador (`signUp` con publishable key) y los triggers sobre `auth.users` (`seed_business_role`, `handle_new_user`) crean el perfil apenas inserta la identidad, por lo que cualquier diseño que verifique *después* del `signUp` ya dejó datos en la BD. La verificación por enlace depende del SMTP por defecto de Supabase, que solo envía a correos del equipo (2/hora) y no expone credenciales para que otro servicio lo use; además GoTrue solo transmite sus propios tokens, por lo que "Supabase envía un código generado por nosotros" no es posible en planes hosted. La API (`apps/api`, Express 5 + Prisma) hoy no tiene rol en el alta y no usa la service role key.

## Goals / Non-Goals

**Goals:**

- Que ni una sola fila personal exista en Postgres (identidad ni perfil) hasta que el correo esté verificado con un código válido.
- Expiración de 10 minutos sin procesos de limpieza: cero tablas temporales, cero cron, cero escrituras en la BD durante el pre-registro.
- Mantener intactos triggers, esquema Prisma, `proxy.ts`, login y `/me`.
- Enviar el correo de registro sin depender del SMTP por defecto de Supabase.

**Non-Goals:**

- Cambiar la recuperación de contraseña (sigue con el enlace de Supabase; ver Risks).
- Modificar la spec de `data-protection` o el esquema de datos.
- Soporte para registro de psicólogos desde la web (sigue siendo solo pacientes, asignado desde el panel admin).
- Internacionalización de la plantilla del correo (español, mismo criterio que el resto de la UI).

## Decisions

### 1. Flujo de dos pasos con pre-registro propio (no `signUp` desde el navegador)

La API expone `POST /api/auth/pre-registro` (genera y envía el código) y `POST /api/auth/verificar-codigo` (valida y crea la cuenta). *Alternativa descartada*: `signInWithOtp` de Supabase — el código lo genera y almacena GoTrue, no podríamos controlarlo ni verificar que "no haya nada en la BD hasta confirmar", y su envío igual requiere un SMTP custom.

### 2. Código en memoria del proceso con vencimiento, sin tabla ni servicio externo

El código se guarda hasheado (SHA-256) en un `Map` del proceso con claves `registro:cod:{email}`, `registro:intentos:{email}` y `registro:reenvio:{email}`, cada una con su propio vencimiento a 600 s. Una entrada se purga al leerse ya vencida y, además, cada `set` barre las vencidas, de modo que el `Map` no crece con el tráfico: la BD queda limpia "por construcción" y no hace falta ningún proceso de limpieza programado.

*Alternativas descartadas*: (a) tabla `codigos_verificacion` + borrado perezoso + `pg_cron` — funciona, pero ensucia Postgres, requiere migración y un job que mantener, y vuelve al pre-registro dependiente de la base de datos (hoy es el único paso del alta que **no** la toca); (b) Upstash Redis u otro almacén KV externo — resolvía la expiración y el estado compartido entre instancias, pero agrega un servicio y unas credenciales que mantener; queda como la migración natural si algún día hace falta escalar horizontalmente. En cualquiera de los dos casos el único punto a cambiar es `obtenerCache()` en `codigo.service.ts`.

Consecuencias asumidas, y documentadas en el README: la API asume **una sola instancia** (con dos procesos, o en un despliegue serverless, una verificación puede llegar a un proceso que no conoce el código y responder `CODIGO_EXPIRADO` aunque sea válido) y un **reinicio pierde los códigos pendientes**, que es una ventana de 10 minutos: quien estaba registrándose pide otro y continúa. Ambas son aceptables para el despliegue previsto (un contenedor).

### 3. Correo con Nodemailer + SMTP de Gmail

Mailer aislado en `apps/api` (`src/services/mailer.service.ts`) trasladando la plantilla HTML del código (marca, código, aviso de 10 minutos). Cuenta Google con verificación en dos pasos y contraseña de aplicación; ~500 correos/día gratuitos. *Alternativas descartadas*: SMTP por defecto de Supabase (solo equipo, 2/hora, imposible enviar un código propio); Resend (requiere cuenta nueva; se deja como migración futura cambiando solo variables de entorno, por eso el mailer es un módulo único con una sola función pública).

### 4. Creación de la cuenta recién al verificar, con `auth.admin.createUser`

Con `SUPABASE_SERVICE_ROLE_KEY` (solo en `apps/api`, jamás en variables `NEXT_PUBLIC_`), `verificar-codigo` llama `auth.admin.createUser({ email, password, user_metadata, email_confirm: true })`. `email_confirm: true` porque el código ya verificó el correo: no se envía el enlace de Supabase y el usuario puede iniciar sesión de inmediato. Los triggers existentes crean `usuarios`/`pacientes`/etc. con los mismos metadatos que hoy envía el formulario — el disparador no se modifica. La contraseña se envía al verificar desde el cliente; la API nunca la almacena ni la registra (la persistencia sigue siendo GoTrue, ver `data-protection`).

Los datos completos del formulario viven solo en el estado del componente entre pasos; el servidor los revalida con los esquemas zod de `packages/shared` antes de crear la cuenta (nunca se confía en el payload del cliente sin revalidar).

### 5. UX en el formulario existente

`register-form.tsx` pasa a dos pasos: (1) formulario actual, sin `signUp`; (2) pantalla de código de 6 dígitos con contador de intentos, reenvío con cooldown de 60 s (mismo patrón que `recover-form.tsx`) y cuenta regresiva de 10 minutos. En el paso 2 hay además un botón "Pegar" que lee el portapapeles del navegador: el correo no puede llevar un botón de copiar (los clientes eliminan el JavaScript), así que se aprovecha el "Copiar código" nativo que Gmail ofrece al detectar el código y el pegado ocurre en la app. Al verificar con éxito se hace `signInWithPassword` desde el cliente y se navega a `/dashboard`, conservando el flujo actual de sesión.

### 6. Controles de abuso

Máximo 5 intentos por código (al agotarse, se borra la clave y se exige reenviar); cooldown de reenvío de 60 s; rate limit por IP en `pre-registro` (contador en la misma cache, p. ej. 5 solicitudes/10 min). El correo repetido responde con el mismo mensaje de "ya existe una cuenta" que hoy muestra el `signUp`, manteniendo la paridad de UX.

## Risks / Trade-offs

- [Gmail: contraseña de aplicación revocada o límite diario superado] → el mailer lanza error controlado: `pre-registro` responde 503 con mensaje amigable, misma UX que el 429 actual de `/recuperar`; migración a Resend = cambiar 3 variables de entorno.
- [API con más de una instancia] → una verificación puede llegar a un proceso distinto del que generó el código y responder `CODIGO_EXPIRADO` con un código válido. El despliegue previsto es de una sola instancia; al escalar, el arreglo es reemplazar `obtenerCache()` por un almacén compartido (ver Decisions 2). Un reinicio de la API pierde los códigos pendientes: la persona pide uno nuevo, sin residuos ni bloqueos.
- [Clave service role filtrada al navegador] → la clave vive exclusivamente en `apps/api/.env`; revisión en tasks de que ningún código de `apps/web` la referencie.
- [Enumeración de correos en `pre-registro`] → se responde el mismo mensaje genérico que ya da hoy el `signUp` ("ya existe una cuenta"); no aumenta la superficie respecto al flujo actual.
- [La recuperación de contraseña sigue limitada por el SMTP por defecto de Supabase] → fuera de alcance aquí; queda registrado como follow-up (custom SMTP en el dashboard o aplicar el mismo patrón de código a `/recuperar`).
- [Dos verificaciones simultáneas con el mismo código] → la segunda `createUser` falla por correo duplicado; se responde "ya registrado" e se invalida el código.

## Migration Plan

Sin migraciones de BD. Despliegue en dos pasos: (1) API con los nuevos endpoints, env vars y dependencias (compatible con el flujo viejo: nadie los llama aún); (2) web con el nuevo formulario. Rollback: revertir el paso 2 vuelve al `signUp` directo sin tocar la API. `mailer_autoconfirm`/plantillas del dashboard de Supabase quedan sin efecto para el registro (el alta ya llega confirmada desde la API).

## Open Questions

- Contenido fino de la plantilla del correo (asunto, textos, botón de ayuda) se define al implementar, sin impacto en specs ni en el desglose de tareas.
