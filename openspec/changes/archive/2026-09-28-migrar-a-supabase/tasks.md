# Tasks: Migración a Supabase

## 1. Bootstrap de la plataforma

- [x] 1.1 Crear `apps/api/prisma/supabase/bootstrap.sql` con la creación del rol `prisma` (`bypassrls`, `createdb`) y los `grant` explícitos sobre el schema `public`; verificar que el script es idempotente y se ejecuta completo en el SQL Editor
- [x] 1.2 Ejecutado contra el proyecto `khlhpcjnpnkpeunjxort`; verificado: `prisma` tiene `rolcanlogin=true`, `rolcreatedb=true`, `rolbypassrls=true`, `rolsuper=false`, `rolcreaterole=false`, y `public` le concede `UC`. Las 12 tablas se crearon después, en 3.4
- [x] 1.3 **Completada.** Asimétricas: `GET /auth/v1/.well-known/jwks.json` responde `200` con una clave `ES256` y `verifyToken` validó tokens reales. Data API: cerrada con `PATCH /v1/projects/<ref>/postgrest` a `db_schema=graphql_public`, que quita `public` de los esquemas expuestos. Verificado con las tres claves: `GET /rest/v1/` responde `401 "Secret API key required"`, las tablas clínicas dan `404` (PostgREST ya no resuelve `public`) y el documento OpenAPI que aún sirve `service_role` no menciona ninguna tabla de la aplicación. Previo a cerrarla se comprobó que **ninguna** línea del código llama a PostgREST (`.from()` / `.rpc()`): la web usa `supabase-js` solo para Auth. Auth intacta: JWKS y `/auth/v1/admin/users` siguen en `200`
- [x] 1.4 Contraseña del rol `prisma` generada fuera del repo y escrita solo en `apps/api/.env` (ignorado por git). Verificado con `git status`: los únicos `.env` modificados son los `.env.example`, sin valor sensible

## 2. Variables de entorno y dependencias

- [x] 2.1 Reescribir `apps/api/src/config/index.ts`: eliminar `jwtSecret`, `jwtExpiresIn` y `allowDemoLogin`; agregar `supabaseUrl` y `databasePoolMax` con validación en producción; verificar que `npm run typecheck --workspace=apps/api` pasa
- [x] 2.2 Actualizar `apps/api/.env.example` con `DATABASE_URL` de Supavisor en modo sesión, `SUPABASE_URL` y `DATABASE_POOL_MAX`; verificar que no quedan `JWT_SECRET`, `JWT_EXPIRES_IN` ni `ALLOW_DEMO_LOGIN`
- [x] 2.3 En `apps/api/package.json` quitar `bcrypt`, `@types/bcrypt`, `jsonwebtoken` y `@types/jsonwebtoken`, agregar `jose` y `@supabase/supabase-js`, y agregar el script `prisma:migrate:deploy`; verificar que `npm install` termina sin errores
- [x] 2.4 En `apps/web/package.json` agregar `@supabase/supabase-js` y `@supabase/ssr`, y en `apps/web/.env.example` agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; verificar que el typecheck de web pasa

## 3. Esquema Prisma y migraciones

- [x] 3.1 En `prisma/schema.prisma` eliminar `User.passwordHash`, cambiar `User.id` a `String @id` sin `@default(uuid())` y eliminar el modelo `TwoFactorAuth` junto con su relación en `User`; verificar que `npm run prisma:validate --workspace=apps/api` pasa
- [x] 3.2 Editar `prisma/migrations/20260927000000_baseline/migration.sql` para quitar la columna `password_hash` y la tabla `two_factor_auth`, dejando 12 tablas; verificado: el SQL de la baseline es idéntico al que `prisma migrate diff --from-empty --to-schema` genera (182 sentencias, sin diferencias)
- [x] 3.3 Migración `20260928000000_auth_user_profile_sync` con las funciones `handle_new_user`, `handle_user_update` y `handle_user_delete`. Los **disparadores** no van en `prisma/migrations/`: se crean sobre `auth.users`, propiedad de `supabase_auth_admin`, y `prisma` no puede recibir esos privilegios, así que `migrate deploy` fallaba con `permission denied for schema auth` y bloqueaba las migraciones siguientes. Se separaron en `prisma/supabase/auth_user_triggers.sql`, que se aplica como `postgres`; las funciones las crea Prisma porque es dueño de las tablas que escriben
- [x] 3.4 Aplicado con `prisma migrate deploy` contra `khlhpcjnpnkpeunjxort`. Verificado: 12 tablas en `public`, `users` sin columna de contraseña, `prisma migrate status` sin drift pendiente y las 4 funciones presentes y `SECURITY DEFINER`. Sin base sombra, por lo que no se ejecutó `migrate dev`. Cuatro correcciones fueron necesarias sobre la marcha: quitar `CREATE SCHEMA IF NOT EXISTS "public"` de la baseline (exige `CREATE` sobre la base y falla con el rol de aplicación), `20260929000000_handle_user_delete_id_cast`, `20260930000000_seed_default_business_role` y el cuarto disparador (`on_auth_user_business_role`, `BEFORE INSERT`) añadido a `prisma/supabase/auth_user_triggers.sql`. El `PATCH /v1/projects/<ref>/database/query` corre como `postgres`, que **no** es superusuario y por tanto no puede borrar filas de `public` (propiedad de `prisma`): la limpieza de datos de prueba hubo que hacerla con la conexión de la API
- [x] 3.5 Regenerar el cliente con `npm run prisma:generate --workspace=apps/api`; verificado: `User` generado no expone `passwordHash`, no se genera `models/TwoFactorAuth.ts` y el typecheck de la API pasa

## 4. Conexión cifrada y agrupada

- [x] 4.1 Reescribir `createPrismaClient` en `apps/api/src/lib/prisma.ts` para pasar un `pg.PoolConfig` con `ssl: { rejectUnauthorized: false }` y `max: config.databasePoolMax` en lugar de una string; verificado: el cliente se instancia sin conexión y la string de `.env.example` no lleva parámetros `ssl*`
- [x] 4.2 Añadir el cierre ordenado del pool de Prisma en el manejador de señales de `apps/api/src/index.ts`; verificado por lint y typecheck: `SIGINT` cierra el servidor y luego devuelve el pool antes de terminar el proceso
- [x] 4.3 Extender `GET /api/health` para reportar el estado de la base de datos mediante una consulta real; verificado con `supertest`: 200 con `database: "up"` y 503 con `database: "down"`

## 5. Autenticación del backend

- [x] 5.1 Reescribir `apps/api/src/utils/jwt.ts` con `jose`: `createRemoteJWKSet` sobre `/auth/v1/.well-known/jwks.json`, `jwtVerify` validando `issuer` y `audience`, extracción de `sub`, `email` y `app_metadata.role`, y fallo cerrado si el rol no está declarado; eliminar `signToken` y `JwtPayload`. El claim llega en **MAYÚSCULAS** (`PSYCHOLOGIST`, porque lo escribe el enum de la base) mientras que `UserRole` de `@psicoagenda/shared` usa minúsculas, así que se cruzan con `toBusinessRole`; sin ese mapeo toda sesión real devolvía 401
- [x] 5.2 Actualizar `requireAuth` en `apps/api/src/middleware/auth.middleware.ts` para consumir el verificador nuevo y traducir el fallo a `AppError.unauthorized`; `requireRole` sin cambios
- [x] 5.3 Reescribir `apps/api/src/services/auth.service.ts` para consultar el perfil por identificador de sesión mediante Prisma, eliminando `demoLogin` y los usuarios hardcodeados; verificado: `config.allowDemoLogin` ya no se referencia en el código
- [x] 5.4 Reescribir `auth.controller.ts` y `auth.routes.ts` para exponer únicamente `GET /api/auth/me` protegido con `requireAuth`; verificado con `supertest`: 401 sin credencial, 401 con encabezado mal formado y 401 con token manipulado. Verificado además contra Supabase real: `200` con el perfil leído de la base
- [x] 5.5 Casos de prueba del verificador: sesión válida, firma ajena, credencial caducada, sesión sin `app_metadata.role`, issuer ajena y rol desconocido; más 6 casos de regresión del criterio de casing, que es lo que faltaba para detectar el bug del punto 5.1. `npm run test --workspace=apps/api`: 21 pruebas

## 6. Paquete compartido

- [x] 6.1 En `packages/shared/src/schemas/index.ts` eliminar `loginSchema`, `createUserSchema`, `demoLoginSchema` y `authResponseSchema`, conservando `passwordSchema` para la validación del formulario de alta; verificado por el typecheck del monorepo
- [x] 6.2 En `packages/shared/src/constants/index.ts` sustituir `JWT_EXPIRATION` por la constante de duración de sesión emitida por el proveedor de identidad (`ACCESS_TOKEN_LIFETIME_SECONDS`)
- [x] 6.3 En `packages/shared/src/types/index.ts` quitar `passwordHash` de `User` y ajustar `SessionUser` a los datos que expone el proveedor de identidad. Nota: `passwordHash` nunca estuvo en el tipo `User` de este paquete; el ajuste consistió en declarar `SessionUser` explícitamente con el origen de cada campo
- [x] 6.4 Ejecutar `npm run build` en la raíz y verificar que no queda ninguna referencia a los esquemas o constantes eliminados

## 7. Frontend

- [x] 7.1 Crear `apps/web/src/lib/supabase/client.ts` y `server.ts` con la instancia compartida a partir de las variables públicas; verificado que el typecheck de web pasa
- [x] 7.2 Reescribir `apps/web/src/lib/session.ts` sobre la sesión del proveedor de identidad, eliminando las claves de `localStorage` y la cookie centinela `pa_session`; verificado que `hasSessionCookie` y `pa_session` ya no aparecen en el repositorio
- [x] 7.3 Reescribir `apps/web/src/lib/use-session.tsx` con `onAuthStateChange`, exponiendo usuario, rol y cierre de sesión derivados del perfil
- [x] 7.4 Reescribir `apps/web/src/proxy.ts` con verificación de identidad en el middleware; verificado en el build: `ƒ Proxy (Middleware)`. Añadido `apps/web/tests/proxy.test.ts` con 5 casos: sin sesión redirige a `/login` (307), con sesión válida deja pasar (200), ruta anidada protegida, y el caso inverso en `/login`. Se cableó `vitest` en `apps/web` y `npm test` corre ambos workspaces
- [x] 7.5 Actualizar `apps/web/src/lib/api-client.ts` para adjuntar el token de la sesión a cada petición
- [x] 7.6 Formularios implementados contra Supabase Auth y verificados en el navegador contra el proyecto real. **El selector de rol del alta se eliminó**: el rol efectivo se lee de `app_metadata`, que el cliente no puede escribir, así que ofrecer "Psicólogo" prometía un permiso que nunca llegaba. El alta es solo de paciente y la promoción quedó documentada en el README. El recorrido en navegador destapó un fallo que las pruebas unitarias no veían: `handle_new_user` ponía `PATIENT` en `public.users.role` pero **no** en `app_metadata`, así que el JWT salía sin rol y `GET /api/auth/me` respondía `401` a una sesión válida. Corregido con la migración `20260930000000_seed_default_business_role`, un `BEFORE INSERT` que siembra el claim. Verificado de punta a punta: alta en el navegador → claim `PATIENT` → `/api/auth/me` `200` con `role: patient`; promoción por el SQL del README → claim `PSYCHOLOGIST` → perfil espejado sincronizado por trigger → re-login → `/api/auth/me` `200` con `role: psychologist`
- [x] 7.7 Filtrar la navegación por el rol del perfil en `app-shell.tsx` y eliminar los botones de acceso rápido de demostración de la pantalla de login

## 8. Pruebas, documentación y verificación

- [x] 8.1 Eliminar `apps/api/tests/auth.demo.test.ts` y establecer la estrategia de pruebas de servicios con `vi.mock("@/lib/prisma")`; verificado que la suite completa se ejecuta sin conexión a la base de datos
- [x] 8.2 Añadir un caso de prueba que compruebe que una ruta protegida rechaza peticiones sin credencial
- [x] 8.3 Actualizar el `README.md` con los pasos de bootstrap, la `DATABASE_URL` de Supabase, el plan B para la base sombra, la migración a claves de firma y el criterio de fechas en UTC. En la ronda contra el proyecto real se corrigieron cuatro cosas que estaban mal documentadas: el usuario de Supavisor es `<rol>.<ref>` y no solo `<rol>`; `pgbouncer=true` sobra en modo sesión; los disparadores de `auth.users` no pueden ir en `prisma/migrations/`, así que el orden de arranque tiene 8 pasos y no 6; y la Data API se cierra quitando `public` de *Exposed schemas*, no con un interruptor. Se añadieron la comprobación `claim`/`perfil`, la guía de promoción de rol, los dos fallos de los disparadores de `auth.users` y el límite de 2 correos por hora del SMTP por defecto
- [x] 8.4 Ejecutar `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` en la raíz; las cuatro pasan (21 pruebas: 16 de la API y 5 de web)
- [x] 8.5 Recorrido manual en el navegador contra el proyecto real, con la API en `:4000` y el frontend en `:3000`:
  - `/agenda` sin sesión redirige a `/login`; con sesión entra
  - alta en `/registro` sin selector de rol → pantalla "Revisa tu correo", sin errores de consola
  - el trigger crea el perfil con `role=PATIENT` y el mismo UUID que la identidad
  - cierre de sesión y alta de nuevo por el formulario de `/login` → `/dashboard`
  - `GET /api/auth/me` → `200` con el perfil leído de la base
  - token manipulado → `401`, sin token → `401`, cabecera no-JWT → `401`
  - `GET /api/health` → `200` con `database: "up"`
  - promoción a `PSYCHOLOGIST` y re-login → `/api/auth/me` → `200` con `role: "psychologist"`
  - baja de la cuenta: la identidad desaparece, el perfil se conserva con `eliminado+<uuid>@psicoagenda.invalid`, `phone` a `NULL` e `is_active` a `false`
  - Sin correo de confirmación real: el SMTP por defecto de Supabase limita a 2 correos por hora y no admite autoconfirm. Se recorrió con `mailer_autoconfirm` activado y **restaurado a `false`** al terminar. Queda documentado en el README
- [x] 8.6 Change archivado. Deltas sincronizados a las specs principales antes de mover: `data-hosting` creada como capacidad nueva (4 requirements), `data-protection` con 1 ADDED (`No almacenamiento de contraseñas`) y 3 MODIFIED (`Cifrado de datos`, `Control de sesiones`, `Confidencialidad profesional`), `user-management` con 2 MODIFIED (`Autenticación`, `Control de roles y permisos`). Ningún requirement eliminado ni renombrado. Contadores del `README.md` actualizados: la tabla de capacidades suma la fila `data-hosting` y el total de requirements pasa de 30 a 35. Verificado: `openspec validate --specs` → `7 passed, 0 failed` y `openspec list --specs` → 7 capacidades sumando 35 requirements
