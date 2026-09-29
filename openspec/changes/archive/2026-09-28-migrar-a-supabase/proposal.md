## Why

El proyecto no tiene una base de datos operativa: `src/lib/prisma.ts` existe pero ningún route lo importa, y la migración baseline se generó offline sin aplicarse nunca. La autenticación es un demo con usuarios hardcodeados y JWT firmado con un secreto propio, lo que contradice la decisión de seguridad de no guardar contraseñas en texto recuperable y deja la verificación de tokens atada a un secreto compartido.

Se adopta Supabase como plataforma de datos: aporta el PostgreSQL gestionado donde aplicar el esquema, resuelve el hosting (hoy una dependencia bloqueante del proyecto) y, con Supabase Auth, delega el manejo de credenciales, verificación de correo y segundo factor a un servicio auditado. Esto reemplaza la decisión de arquitectura "JWT + bcrypt" registrada en el change archivado `planificar-arquitectura`.

## What Changes

### Base de datos (hosting)

- La base de datos pasa de "PostgreSQL que hay que instalar localmente" a **Supabase managed PostgreSQL**. El motor no cambia: Prisma sigue con `provider = "postgresql"` y los 15 modelos del esquema no se tocan.
- `DATABASE_URL` apunta a Supabase vía **Supavisor en modo sesión** (puerto 5432), porque el entorno de desarrollo no tiene IPv6 global y la conexión directa `db.<ref>.supabase.co` no es alcanzable.
- La conexión pasa a construirse con un `pg.PoolConfig` explícito para forzar **TLS** y fijar el tamaño del pool. El valor por defecto de `pg` es texto plano, y `sslmode=require` en la URL se comporta como `verify-full` en `pg-connection-string`, lo que falla contra el certificado de Supabase.
- Se crea un rol `prisma` dedicado con `bypassrls` y `createdb` (SQL de bootstrap versionado en el repo), en lugar de usar el rol `postgres`.
- Se documenta el flujo de migraciones: `migrate dev` en desarrollo (requiere base sombra) y `migrate deploy` en producción.

### Autenticación (Supabase Auth)

- **BREAKING** Se elimina `POST /api/auth/demo-login`, el servicio `demoLogin` con sus usuarios hardcodeados, y las variables `JWT_SECRET`, `JWT_EXPIRES_IN` y `ALLOW_DEMO_LOGIN`.
- **BREAKING** Se elimina la columna `users.password_hash`. Las contraseñas pasan a vivir cifradas en Supabase Auth (`auth.identities`) y el sistema deja de implementar cifrado de contraseñas.
- `public.users` deja de ser fuente de verdad de identidad y pasa a ser un **perfil espejado**: sus `id` son los UUID de `auth.users`, y triggers `ON auth.users` mantienen sincronizados `email`, `is_active` y `last_login_at`.
- **BREAKING** Se elimina el modelo `TwoFactorAuth` de Prisma. El segundo factor pasa a ser el MFA de Supabase Auth; conservar los secretos TOTP en el schema propio sería duplicar y exponerlos.
- La API deja de **emitir** tokens. `signToken` desaparece; `verifyToken` se reescribe con `jose` validando la firma contra el JWKS del proyecto (asimétrico), más `issuer` y `audience`. El secreto compartido deja de existir en el backend.
- El rol de aplicación viaja en el claim `app_metadata.role` (inmutable desde el cliente). El claim `role` del JWT de Supabase es `authenticated` y **no** representa el rol de negocio.
- **BREAKING** El frontend deja de managear el token en `localStorage` y la cookie centinela `pa_session`. La sesión pasa a ser la de Supabase Auth, y `proxy.ts` deja de comprobar una cookie para verificar la identidad real del usuario.
- Se elimina la dependencia `bcrypt` y `jsonwebtoken`; se agregan `jose` y `@supabase/supabase-js`.

### Superficie de datos de Supabase

- La **Data API de Supabase se desactiva**. Las tablas en el schema `public` no tienen RLS y, con la Data API activa, la clave `anon` podría leer expedientes clínicos sin pasar por la autorización de la API.
- Prisma **nunca** referencia los schemas `auth` ni `storage` en el datasource: Supabase los modifica para entregar nuevas funciones y referenciarlos genera drift que `migrate dev` intentará revertir.
- Se fija el criterio de fechas: todo se almacena en **UTC** y se convierte en la presentación.

## Capabilities

### New Capabilities

- `data-hosting`: dependencia de la plataforma de datos — conexión cifrada y agrupada, prohibición de tocar los schemas gestionados por el proveedor, sincronización del perfil desde el proveedor de identidad, y flujo de aplicación de migraciones.

### Modified Capabilities

- `user-management`: la autenticación, el registro y la recuperación de contraseña se ejecutan contra Supabase Auth; el rol pasa a leerse de un claim inmutable; se elimina el acceso de demostración por rol.
- `data-protection`: se endurece el cifrado en tránsito (verificación asimétrica de tokens, TLS obligatorio a la base de datos) y el control de sesiones pasa de un JWT de 7 días a tokens de acceso cortos con refresco; se añade la garantía de que la Data API del proveedor no expone los datos clínicos.

## Impact

**Esquema y datos**

- `apps/api/prisma/schema.prisma`: se elimina `User.passwordHash`, `User.id` deja de autogenerarse (lo provee el trigger) y se elimina el modelo `TwoFactorAuth`.
- `apps/api/prisma/migrations/20260927000000_baseline/`: se edita en lugar de encadenar una migración correctiva. No está aplicada en ningún entorno y el change `alinear-dominio-shared-prisma` ya justificó cerrar relaciones mientras fuera posible.
- Nueva migración con los triggers de sincronización sobre `auth.users`.

**Backend (`apps/api`)**

- `src/config/index.ts`: se reescriben las variables de entorno.
- `src/lib/prisma.ts`: configuración explícita de pool y TLS.
- `src/utils/jwt.ts`, `src/middleware/auth.middleware.ts`: verificación contra JWKS. `requireRole` no cambia.
- `src/services/auth.service.ts`, `src/controllers/auth.controller.ts`, `src/routes/auth.routes.ts`: se elimina el demo login; queda la consulta de perfil.
- `package.json`: se ajustan dependencias y se agrega `prisma:migrate:deploy`.

**Frontend (`apps/web`)**

- `src/lib/session.ts` y `src/lib/use-session.tsx`: se reescriben sobre la sesión de Supabase.
- `src/proxy.ts`: verificación real de identidad en lugar de la cookie centinela.
- `src/lib/api-client.ts`, `login-form.tsx`, `register-form.tsx`: dejan los `TODO` de autenticación real.
- `package.json`: `@supabase/supabase-js` y `@supabase/ssr`.

**Paquete compartido y pruebas**

- `packages/shared`: se eliminan los esquemas de autenticación propios y `JWT_EXPIRATION`; `User` deja de exponer `passwordHash`.
- `apps/api/tests/auth.demo.test.ts` se elimina. Se establece la estrategia de pruebas para servicios que dependen de Prisma, que hoy no existe.

**No cambia**: los servicios, controladores, middleware de validación y manejo de errores existentes, los 15 modelos de dominio más allá de `User` y `TwoFactorAuth`, la lógica de `packages/shared` de citas, y todas las pantallas que hoy consumen `mock-data.ts`.
