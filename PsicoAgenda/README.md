# PsicoAgenda

Sistema orientado a profesionistas de la psicología para la gestión integral de la práctica clínica: programación de citas, historiales clínicos psicológicos, recordatorios automáticos (WhatsApp/correo) y roles de usuario. Busca automatizar procesos, garantizar la confidencialidad y mejorar la comunicación profesional-paciente.

> Proyecto desarrollado con **spec-driven development** usando [OpenSpec](https://openspec.co). Las especificaciones actuales viven bajo `openspec/`; el documento maestro plano `psicoagenda_openspec.md` se conserva como referencia histórica.

## Alcance

**Incluye:**
- Gestión de citas y agenda digital.
- Historiales clínicos psicológicos individuales.
- Recordatorios automáticos para pacientes (WhatsApp y correo).
- Gestión de usuarios y roles (Psicólogo/a, Paciente, Sistema).
- Generación de reportes operativos exportables a PDF/Excel.

**Excluye:**
- Módulos de facturación electrónica o contabilidad.
- Videollamadas.
- Expedientes médicos interdisciplinarios.

> **Nota sobre RD-14:** el sistema sí registra el *estado de pago de honorarios* (pendiente/pagado) como control administrativo del consultorio, pero esto no equivale a un módulo de facturación electrónica.

**Plataformas:** Aplicación multiplataforma compatible con Windows, Android y cualquier navegador moderno.

## Contenido del repositorio

| Ruta | Descripción |
|------|-------------|
| `openspec/` | Fuente de verdad: especificaciones formales de OpenSpec |
| `openspec/project.md` | Contexto del proyecto (visión, alcance, actores, RNF, RD) |
| `openspec/specs/` | Capacidades del sistema en formato OpenSpec (`spec.md`) |
| `openspec/changes/` | Cambios propuestos (flujo propose → apply → archive) |
| `openspec/config.yaml` | Configuración de OpenSpec (schema `spec-driven`, idioma `es`) |
| `apps/api/` | Backend Express 5 + TypeScript + Prisma 7 |
| `apps/api/prisma/supabase/bootstrap.sql` | Alta del rol `prisma` en Supabase (SQL Editor) |
| `apps/api/prisma/supabase/grants.sql` | Devuelve a `postgres` los privilegios sobre el esquema, tras `migrate deploy` |
| `apps/web/` | Frontend Next.js 16 + Tailwind v4 + shadcn/ui + PWA Serwist |
| `packages/shared/` | Tipos, esquemas Zod y constantes compartidas |
| `.opencode/` | Slash commands y skills de OpenSpec para opencode |
| `psicoagenda_openspec.md` | Documento maestro original (referencia histórica) |
| `README.md` | Este archivo |

### Capacidades actuales (`openspec/specs/`)

| Capacidad | Descripción | Requirements |
|-----------|-------------|--------------|
| `user-management` | Registro, autenticación, roles, perfiles, tutores legales | 5 |
| `appointment-management` | Agenda: programar, modificar, cancelar, disponibilidad, asistencia | 5 |
| `notification-management` | Recordatorios 24 h, confirmación asistencia, notificaciones de cambio | 3 |
| `medical-record` | Historial clínico, bitácora por sesión, consentimiento, contacto de emergencia | 7 |
| `reporting` | Reportes estadísticos de citas exportables a PDF/Excel | 2 |
| `data-hosting` | Persistencia en PostgreSQL gestionado, frontera con los schemas del proveedor, perfil sincronizado y migraciones versionadas | 4 |
| `data-protection` | Cifrado, sesiones, ausencia de contraseñas en la base, LFPDPPP, respaldo AWS, retención y portabilidad | 9 |
| **Total** | | **35** |

`user-management` ya no incluye 2FA: la autenticación en dos pasos es responsabilidad del proveedor de identidad, que la ofrece en su panel. `data-protection` suma el requirement `No almacenamiento de contraseñas`, que se explica en la sección de datos de más abajo.

## Requisitos previos

- **Node.js** ≥ 20.19.0 y **npm** ≥ 9.
- Un **proyecto de Supabase** (PostgreSQL gestionado + Auth). No hace falta PostgreSQL local: el motor se persiste en la plataforma y la conexión se establece cifrada por Supavisor.
- **OpenSpec CLI** instalado globalmente:

```bash
npm install -g @fission-ai/openspec
openspec --version
```

## Datos y autenticación: Supabase

El sistema persiste en el PostgreSQL gestionado de Supabase y delega las credenciales y el segundo factor en Supabase Auth. El backend **no emite tokens** ni almacena contraseñas. La verificación del correo de registro la orquesta la API con un código de un solo uso (ver [Registro con código de verificación](#registro-con-código-de-verificación)).

- **La API es la única vía de acceso a los datos.** Las tablas de `public` no tienen RLS y el rol `prisma` es su único propietario, así que `anon`, `authenticated` y `service_role` no tienen **ningún** privilegio sobre ellas. Aun así la Data API está **desactivada** (el proyecto no expone `public`), de modo que PostgREST tampoco publica el esquema OpenAPI con los nombres de tabla y columna. El orden y la comprobación están en el paso 3.
- **El rol de negocio viaja en `app_metadata.role`**, que el cliente no puede editar. El claim `role` de nivel superior del JWT vale `authenticated` y es el rol de PostgreSQL, no el de negocio. Ojo al casing: el claim llega en **MAYÚSCULAS** (`PSYCHOLOGIST`) porque lo escribe el enum de la base, mientras que `UserRole` de `@psicoagenda/shared` usa minúsculas; el backend lo cruza en `toBusinessRole` (`apps/api/src/utils/jwt.ts`).
- **`public.usuarios` es un perfil espejado** de la identidad: sus `id` son los UUID de `auth.users` (columna `uuid`, sin FK) y los triggers mantienen sincronizados `correo`, `nombre_completo`, `rol`, `activo` y `ultimo_acceso`. El esquema está en **español** (16 tablas + 4 vistas `vw_*`) y el modelo de Prisma usa nombres de campo en inglés con `@map`/`@@map`, de modo que el código TypeScript no cambia. `rol` es el enum español (`PACIENTE`/`PSICOLOGO`/`ADMINISTRADOR`): el claim del JWT sigue en inglés y el trigger lo traduce al escribir la fila. Prisma nunca referencia los schemas `auth` ni `storage`.
- **Cifrado en tránsito:** la conexión usa un `pg.PoolConfig` con `ssl: { rejectUnauthorized: false }` (ver `apps/api/src/lib/prisma.ts`). Endurecimiento pendiente: `rejectUnauthorized: true` con el `root.crt` que Supabase publica en el dashboard.
- **Fechas:** todo se almacena en **UTC** y se convierte en la presentación. No se mezclan horas locales en los datos.

### Orden de arranque

> El orden importa: la migración baseline se editó en lugar de encadenar una correctiva, así que **debe aplicarse por primera vez después** del bootstrap. Si alguna vez se aplicó antes, hay que regenerarla.

**1. Crear el proyecto y el rol `prisma`.** Ejecutar `apps/api/prisma/supabase/bootstrap.sql` en el SQL Editor (Dashboard → SQL Editor). El script es idempotente: genera la contraseña del rol y la muestra en el panel de avisos. **Guárdala en un gestor de contraseñas**: no la escribas en ningún archivo del repositorio.

El rol se crea con `createdb` (imprescindible: `@prisma/adapter-pg` crea la base sombra de `migrate dev`) y `bypassrls` (la API es la única vía de acceso y su autorización vive en `requireRole`).

Verificar:

```sql
SELECT rolname, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = 'prisma';
```

Debe devolver una fila con ambos atributos en `true`.

**2. Migrar a claves de firma asimétricas.** Authentication → Signing Keys. Los proyectos nuevos ya usan claves asimétricas; sin este paso `verifyToken` no valida ningún token porque la firma es simétrica.

Verificar que el JWKS responde:

```bash
curl https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
```

**3. Desactivar la Data API.** Settings → API → *Exposed schemas*, y quitar `public`. Equivale a `PATCH /v1/projects/<ref>/postgrest` con `{"db_schema":"graphql_public"}` en la Management API, que es lo que se hizo en este proyecto.

Es el paso que blinda el dato clínico, y la razón es concreta: sin RLS, cualquier clave con permiso de lectura sobre `public` se saltaría el `requireRole` de la API. En este proyecto ya no queda ninguna: `public` es propiedad exclusiva de `prisma` y `anon`, `authenticated` y `service_role` no tienen privilegio alguno sobre ella. Quitar `public` de los esquemas expuestos cierra además el esquema OpenAPI, que si no enumera nombres de tabla y columna a quien tenga una secret key.

Cómo comprobarlo. Con la *publishable* key (la que viaja en el navegador):

```bash
# 401 "Secret API key required"
curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

# 404: ya no resuelve la tabla, porque no busca en `public`
curl -s "$SUPABASE_URL/rest/v1/usuarios?select=id" -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Un `404` en la segunda es el resultado correcto, no un descuido: significa que PostgREST ya no resuelve `public`. Si devolviera `200`, o si `claim y perfil` salieran con datos, habría que revisar el paso.

El JWT y la Auth API no se ven afectados: viven en `/auth/v1/`, que es un servicio aparte de PostgREST.

**4. Configurar el entorno:**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

El flujo de registro (código de verificación por correo) usa tres variables más de `apps/api/.env`, documentadas en el propio `.env.example`:

| Variable | Uso |
|----------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Crea la cuenta recién verificada desde la API. Solo servidor; jamás en `apps/web` ni en `NEXT_PUBLIC_*`. |
| `GMAIL_USER` | Remitente del SMTP de Gmail que envía el código de registro. |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de esa cuenta (requiere verificación en dos pasos). |

En producción, si falta alguna la API **no arranca** (error explícito al cargar la configuración). En desarrollo, si falta alguna de las de correo: aviso en consola y modo degradado — el código se escribe en la consola de la API en lugar de enviarse.

`DATABASE_URL` usa **Supavisor en modo sesión**:

```bash
DATABASE_URL="postgresql://prisma.<REF>:<CONTRASENA>@aws-<N>-<region>.pooler.supabase.com:5432/postgres"
```

- El usuario es `<rol>.<ref_del_proyecto>`, no solo el rol: Supavisor enruta por tenant y rechaza la conexión si falta el ref (`ENOTFOUND: tenant/user ...`).
- El host del pooler es `aws-<N>-<region>.pooler.supabase.com`. El índice `N` **no se adivina**: el `aws-0` que circula por los ejemplos no tiene por qué ser el del proyecto y un índice equivocado da `ENOTFOUND: tenant/user ... not found`. Se copia de Project Settings → Database. En este proyecto es `aws-1-ca-central-1`.
- El modo directo (`db.<ref>.supabase.co`) es IPv6 y no es alcanzable desde entornos sin IPv6 global.
- El modo transacción (puerto 6543) queda descartado: no soporta sentencias preparadas, que Prisma emite por debajo.
- **No agregues `pgbouncer=true`**: desactiva el caché de planes preparados y solo hace falta en modo transacción.
- **La URL no debe llevar parámetros `ssl*`**: `pg-connection-string` los traduce a `verify-full` y falla contra el certificado de Supabase con `SELF_SIGNED_CERT_IN_CHAIN`. El TLS se configura en el `PoolConfig`, no en la cadena.

**5. Aplicar el esquema, devolver los privilegios a `postgres` y generar el cliente:**

```bash
# Aplica la única migración (la baseline del esquema en español). No crea base sombra.
npm run prisma:migrate:deploy --workspace=apps/api

# `prisma` es dueño de las tablas que acaba de crear, así que `postgres` (el rol del
# SQL Editor) se queda sin escritura sobre ellas. Este GRANT se la devuelve.
npx prisma db execute --file prisma/supabase/grants.sql

npm run prisma:generate
```

**Sobre la baseline.** `prisma/migrations/20261013000000_baseline_esquema_espanol` contiene los 16 modelos de `schema.prisma` **más** los objetos que Prisma 7 no sabe modelar: los 17 CHECK de negocio, los índices parciales y GiST (el anti-solape de citas), las 4 vistas `vw_*` y las 4 funciones de sincronización con `auth.users`. Por eso **no** se usa `migrate dev`: compara `schema.prisma` contra una base sombra y reportaría drift en todo lo escrito a mano. El flujo del proyecto es `migrate diff` + `migrate deploy`, sin base sombra:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o baseline_ddl.sql
```

**Si de verdad hace falta `migrate dev`** (una migración nueva sobre el esquema), hay que asumir el drift de los objetos escritos a mano o moverlos a su propia migración. La base sombra la crea `@prisma/adapter-pg` como `prisma_migrate_shadow_db_<uuid>`; si Supabase la rechaza por `statement timeout`, queda el respaldo del `shadowDatabaseUrl`:

```ts
// apps/api/prisma.config.ts
datasource: {
  url: env("DATABASE_URL"),
  shadowDatabaseUrl: env("SHADOW_DATABASE_URL"), // segundo proyecto
}
```

**6. Activar los triggers de perfil.** Ejecutar `apps/api/prisma/supabase/auth_user_triggers.sql` en el SQL Editor del dashboard (Dashboard → SQL Editor), que corre como `postgres`.

Van aparte de las migraciones a propósito: los triggers se crean sobre `auth.users`, que es propiedad de `supabase_auth_admin`, y para eso hacen falta privilegios que el rol `prisma` no tiene ni puede recibir. Si el DDL estuviera en `prisma/migrations/`, `migrate deploy` fallaría con `permission denied for schema auth` y bloquearía **todas** las migraciones posteriores. Las funciones sí las crea Prisma (viven en la baseline `20261013000000_baseline_esquema_espanol`); solo los disparadores se aplican con `postgres`.

`migrate status` no cubre este archivo. Si lo editas, vuelve a aplicarlo: es idempotente.

Verificar que los cuatro existen, y que el primero es `BEFORE INSERT`:

```sql
SELECT tgname, CASE WHEN (tgtype & 2) > 0 THEN 'BEFORE' ELSE 'AFTER' END AS momento
  FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
 ORDER BY tgname;
```

Comprobación de que el espejo funciona: registra un usuario y verifica que aparece el perfil **con rol en los dos sitios**. Las dos columnas tienen que coincidir, y no es casualidad:

```sql
SELECT a.email,
       a.raw_app_meta_data ->> 'role' AS claim,
       u.rol::text                    AS perfil
  FROM auth.users a JOIN public.usuarios u ON u.id = a.id;
```

Tienen que coincidir salvo por el idioma del enum: `PATIENT`/`PACIENTE`, `PSYCHOLOGIST`/`PSICOLOGO`, `ADMIN`/`ADMINISTRADOR`.

Si `claim` sale `NULL` y `perfil` sale `PACIENTE`, la API responderá `401` a una sesión válida. Es el síntoma del bug que corrigió el sembrado `seed_business_role` (hoy vive en la baseline).

**7. Verificar la conexión:** `GET /api/health` ejecuta una consulta real y responde `200` con `database: "up"`, o `503` con `database: "down"` si falla.

**8. Recorrido manual:** formulario de `/registro` → código de 6 dígitos por correo → inicio de sesión → `GET /api/auth/me` → petición con token manipulado (debe responder `401`).

## Notas sobre los triggers de `auth.users`

Fallan en silencio si el snapshot no está limpio, y los dos casos que se encontraron costaron una sesión de depuración:

- **En un `AFTER DELETE`, `NEW` es `NULL`.** La fila borrada vive en `OLD`. Un `WHERE id = new.id` no casa con nada: la baja devolvía `200` pero dejaba el perfil con su correo original y `activo = true`.
- **`id` es `uuid` en los dos lados.** `public.usuarios.id` y `auth.users.id` son `uuid`, así que las funciones comparan sin cast. Si alguna vez se cambia el perfil a `id text`, reaparece el `operator does not exist` en la baja: el cambio arrastra a las cuatro funciones.

Ninguno de los dos se detecta en el alta, porque en un `AFTER INSERT` `NEW` sí está poblado y en el `INSERT` existe una conversión de asignación de `uuid` a `text`. Conviene ejercitar la baja a mano tras tocar estas funciones.

## Por qué un alta pública nace con `PATIENT` en los dos sitios

La API lee el rol de negocio del claim `app_metadata.role` y **falla cerrada** si no lo encuentra. Ese rol lo escribe un disparador `BEFORE INSERT` sobre `auth.users`, que siembra `PATIENT` cuando el alta no declara ninguno.

Sin ese sembrado, el alta quedaba a medias: el perfil espejado sí recibía `PATIENT`, pero el JWT salía sin rol, así que `GET /api/auth/me` respondía `401 "No autenticado"` con una sesión perfectamente válida. El síntoma es desconcertante porque el alta devuelve éxito, el perfil aparece con el rol correcto en la base y el usuario entra al panel; lo único que falla es la API. Se detectó recorriendo el alta real contra el proyecto, no en las pruebas: los tests unitarios pasaban porque usaban un token con el rol ya puesto a mano.

El sembrado deja `app_metadata.role` en inglés (`PATIENT`) porque es el claim que leen la API y la web. La traducción al enum español (`PACIENTE`) la hace `handle_new_user` al escribir `public.usuarios.rol`, así que los dos sitios quedan coherentes por construcción.

Dos decisiones de diseño detrás del arreglo:

- **El sembrado va antes del `AFTER INSERT`, no dentro de `handle_new_user`.** Escribir `auth.users` exige ser `supabase_auth_admin`; `handle_new_user` es `SECURITY DEFINER` con dueño `prisma`, así que un `UPDATE` dentro de ella fallaría con `permission denied`. Y llamar a una función auxiliar sin `SECURITY DEFINER` desde dentro tampoco serviría: se ejecutaría con el usuario efectivo, que ya es `prisma`. Un `BEFORE INSERT` corre como el rol que inserta y puede reescribir `NEW`. De paso deja el perfil y el claim coincidiendo por construcción, en vez de por dos reglas que puedan divergir.
- **Solo rellena el hueco.** Si el claim ya declara un rol válido, no se toca. Un alta pública no puede obtener `PSYCHOLOGIST` ni `ADMIN` porque `app_metadata` no es escribible por el cliente, y la promoción sigue siendo la operación administrativa del apartado anterior.

## Registro con código de verificación

`/registro` **no** crea la cuenta con `auth.signUp`. La crea la API, y solo después de comprobar un código de 6 dígitos que envía por correo: la base de datos nunca ve datos de un formulario que nadie confirmó — ni identidad, ni perfil espejado, ni expediente.

1. **Paso 1 — `POST /api/auth/pre-registro`.** El navegador revalida el formulario (`registroPacienteSchema` de `packages/shared`) y lo manda a la API, que lo revalida otra vez y responde `{ ok: true, expiresInSeconds: 600, resendCooldownSeconds: 60 }`. Todavía no existe ninguna cuenta.
2. **Paso 2 — `POST /api/auth/verificar-codigo`.** Con el código correcto la API llama a `auth.admin.createUser({ email_confirm: true })` con la *service role*, y recién entonces los triggers de `auth.users` crean el perfil, la ficha del paciente y su contacto de emergencia (y el tutor, si es menor). El expediente clínico no lo crea el trigger: se crea bajo demanda la primera vez que se abre (`clinical-record.service.ts`). El código se consume **después** del alta: si Supabase falla, la persona reintenta con el mismo código.
3. **Sesión.** La web hace `signInWithPassword` con las credenciales que ya tenía y entra a `/dashboard`.

Cada decisión tiene su motivo:

- **El código lo genera la API** (`crypto.randomInt`), no Supabase, y se guarda en la cache como hash SHA-256: si la cache se filtrara, el código de 6 dígitos no es recuperable.
- **La cache es la memoria del proceso** (`codigo.service.ts`), sin servicio externo. No hay tabla de códigos ni `pg_cron`: cada entrada lleva su vencimiento de 600 s y se purga sola al leerse y en cada escritura, así que no queda residuo que limpiar y la base de datos nunca se toca durante el pre-registro. Dos consecuencias del diseño que conviene tener presentes: la API asume **una sola instancia** (con varias, una verificación puede caer en un proceso que no conoce el código) y un **reinicio pierde los códigos pendientes** — basta con que la persona pida otro. Si algún día hacen falta varias instancias, `obtenerCache()` en ese servicio es el único punto a cambiar por un Redis externo.
- **Límites:** 5 intentos por código (`MAX_INTENTOS_CODIGO`), 60 s de cooldown para reenviar y 5 solicitudes por IP cada 10 minutos. Los errores son explícitos (`CODIGO_INVALIDO`, `CODIGO_EXPIRADO`, `CODIGO_AGOTADO`, `COOLDOWN`, `RATE_LIMIT`) y la pantalla del código muestra la cuenta regresiva de los 10 minutos.
- **El código se pega con un botón.** El correo no puede incluir un botón que copie (los clientes de correo eliminan el JavaScript), así que el paso 2 ofrece **Pegar**: lee el portapapeles, tolera espacios entre dígitos y el texto completo del correo, y avisa si el navegador no da acceso o si no hay un código en él. Gmail, además, suele mostrar su propio "Copiar código" al detectar el código en el mensaje.
- **`is_minor` lo deriva el servidor** de `birth_date` (con `esMenorDeEdad`, la misma función en ambos lados) y exige tutor cuando corresponde: el cliente no puede declarar que no es menor para saltarse el requisito.
- **Teléfonos locales de 10 dígitos.** Los tres teléfonos del registro (personal, emergencia y tutor) usan la máscara `555-123-4567` y se validan por cantidad de dígitos, no por longitud del texto; al pegar con lada se toman los últimos 10. Arriba del formulario, **"¿Para quién es la cuenta?"** muestra la sección **Datos del tutor legal** desde el principio; en una cuenta de menor, el teléfono del tutor se usa como contacto y el teléfono personal queda deshabilitado, y el consentimiento del tutor se firma junto al aviso de privacidad. La fecha de nacimiento sigue siendo la que manda.
- **La *service role* solo vive en la API** (`src/config` → `lib/supabase-admin.ts`). La web no la ve ni puede leer tablas de `public`; el acceso a datos sigue pasando por la API con el token de sesión.

### Correo saliente y límites del mailer

El código sale por **SMTP de Gmail** (Nodemailer + contraseña de aplicación) desde `mailer.service.ts`, aislado del resto: para cambiar de proveedor basta con reemplazar ese módulo y las variables de entorno.

- La cuenta remitente necesita **verificación en dos pasos** para emitir una contraseña de aplicación; sin ella, `GMAIL_APP_PASSWORD` no existe.
- Gmail aplica **cuotas diarias por cuenta remitente** (cientos de destinatarios en cuentas personales, más en Workspace) y puede bloquear temporalmente el envío. Es un límite operativo, no un contrato: si el envío falla, `pre-registro` responde `503 MAILER_ERROR` y **no** crea nada, así que la persona puede reintentar sin residuos.
- Para volumen real o dominio propio conviene un proveedor transaccional (Resend, SendGrid): el flujo funciona igual porque el código y la verificación no dependen del transporte.
- Sin credenciales en desarrollo, el modo degradado escribe el código en la consola de la API y `pre-registro` sigue respondiendo `201`.

## Límite de correos en el entorno de pruebas

Esta nota aplica a los correos que envía **Supabase Auth** (sobre todo la recuperación de contraseña). El registro con código de verificación **ya no pasa por ahí**: usa el SMTP de Gmail propio, así que `rate_limit_email_sent` no lo afecta.

El proyecto usa el SMTP por defecto de Supabase, que permite **2 correos por hora** (`rate_limit_email_sent`) y **no admite confirmaciones automáticas** por defecto. Consecuencias al ejercitar la recuperación de contraseña en un entorno recién creado:

- El segundo correo por hora falla con `429` y **no se envía nada**; en la recuperación de contraseña la API de Supabase responde con error y la persona no recibe el enlace.
- `rate_limit_email_sent` solo se puede subir por la Management API si además hay un SMTP propio configurado; la Management API rechaza el cambio con `Custom SMTP required to configure ... RATE_LIMIT_EMAIL_SENT`.

Para pruebas automatizadas hay dos salidas, y ambas tocan configuración del proyecto, así que conviene reversirlas al terminar:

- `PATCH /v1/projects/<ref>/config/auth` con `{"mailer_autoconfirm": true}`: las altas entregan sesión sin enviar correo, así que no chocan con el límite.
- Esperar a que se libere la hora, o configurar SMTP propio (Authentication → Email), que además es lo que corresponde en producción para no depender del servicio de Supabase. Es el mismo camino que ya sigue el código de registro con el SMTP de Gmail; migrar la recuperación de contraseña a ese mailer es el follow-up pendiente.

## Promover una cuenta a psicólogo o administrador

El registro público (`/registro`) crea **siempre** cuentas de paciente, y el formulario no ofrece elegir rol. No es una decisión de interfaz: el rol efectivo vive en `app_metadata.role`, que el cliente no puede escribir, y el trigger de alta lo lee de ahí con `upper(raw_app_meta_data ->> 'role')`. Enviar el rol pedido en `user_metadata` no concede nada, así que el selector se retiró en lugar de prometer un permiso que no llegaba.

Para dar de alta o promover un profesional:

1. **Crear la identidad** en Authentication → Users, o dejar que se registre por el formulario y promoverla después.
2. **Escribir el rol en `app_metadata`**, nunca en `user_metadata`: Authentication → Users → *Edit* → *User Metadata*, o desde el panel SQL:

```sql
UPDATE auth.users
   SET raw_app_meta_data = jsonb_set(
         coalesce(raw_app_meta_data, '{}'::jsonb),
         '{role}', '"PSYCHOLOGIST"'::jsonb, true)
 WHERE email = 'profesional@ejemplo.com';
```

3. **El perfil espejado se actualiza solo**: el trigger `on_auth_user_updated` copia el rol a `public.usuarios.rol`, ya traducido al enum español (`PSYCHOLOGIST` → `PSICOLOGO`).
4. **Cerrar y volver a iniciar sesión.** El rol viaja en el JWT, así que una sesión abierta conserva el rol anterior hasta que caduca o se renueva. Sin este paso, `/api/auth/me` sigue devolviendo el rol viejo y parece que la promoción no surtió efecto.

Los valores válidos son `PATIENT`, `PSYCHOLOGIST` y `ADMIN`, en mayúsculas. El JWT los lleva tal cual porque los escribe el enum de la base, y la API los cruza con `toBusinessRole` en `apps/api/src/utils/jwt.ts`.

## Estructura del monorepo

```text
PsicoAgenda/
├── apps/
│   ├── api/    # Backend Express 5 + Prisma 7
│   └── web/    # Frontend Next.js 16 + PWA
├── packages/
│   └── shared/ # Tipos, schemas y constantes compartidas
├── openspec/   # Especificaciones del proyecto
└── package.json # Workspaces de npm
```

## Cómo inicializar el proyecto

### 1. Clonar el repositorio

```bash
git clone <url-del-repo> PsicoAgenda
cd PsicoAgenda
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Ajusta `DATABASE_URL`, `SUPABASE_URL` y las claves públicas de Supabase en los archivos `.env` (ver [Datos y autenticación: Supabase](#datos-y-autenticación-supabase)).

### 4. Generar el cliente de Prisma

```bash
npm run prisma:generate
```

### 5. Ejecutar migraciones (requiere el proyecto de Supabase)

```bash
npm run prisma:migrate:deploy --workspace=apps/api
npx prisma db execute --file prisma/supabase/grants.sql
```

> La baseline deja el esquema completo (16 tablas + 4 vistas) y vacío. Los triggers
> de `auth.users` no van aquí: se aplican con `postgres` en el paso 6 del orden de
> arranque. El seed sigue siendo un placeholder; las cuentas de ejemplo están en
> `.env.credenciales`.

### 6. Levantar en desarrollo

```bash
# Ambas aplicaciones a la vez
npm run dev

# O por separado
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

### 7. Verificar la estructura

```bash
# Lista las capacidades y su número de requirements
openspec list --specs

# Estado de salud del root de OpenSpec
openspec doctor

# Contexto de trabajo del proyecto
openspec context
```

### 8. Validar las especificaciones

```bash
openspec validate --specs
```

Debe devolver: `7 passed, 0 failed`, una capacidad por cada fila de la tabla de arriba.

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Levanta API y web en paralelo |
| `npm run dev:api` | Levanta solo el backend |
| `npm run dev:web` | Levanta solo el frontend |
| `npm run typecheck` | Typecheck de todo el monorepo |
| `npm run lint` | Lint de API y web |
| `npm test` | Tests de la API y de la web (`apps/api` y `apps/web`) |
| `npm run build` | Build completo (shared → api → web + service worker) |
| `npm run prisma:generate` | Genera el cliente de Prisma 7 |
| `npm run prisma:migrate` | Ejecuta `migrate dev` (solo para migraciones nuevas; con la baseline escrita a mano reporta drift) |
| `npm run prisma:migrate:deploy --workspace=apps/api` | Aplica solo las migraciones pendientes (publicación) |

## Despliegue

Frontend en Vercel; API en Vercel con Supabase como base de datos y Auth.

### Dos proyectos, no uno

`apps/api` monta todo bajo `/api/*` y el Next de `apps/web` también usa `/api/*`,
así que van separados:

| | Web | API |
|---|---|---|
| Root Directory | `PsicoAgenda/apps/web` | `PsicoAgenda/apps/api` |
| Dominio | `psicoagenda.vercel.app` | `psicoagenda-api.vercel.app` |
| Región de funciones | la más cercana al usuario | **la misma del proyecto Supabase** |

La API se sirve como una sola función de Express (entry `apps/api/server.mjs`,
que importa `dist/app.js` ya compilado). El build lo hace `npm run build`
(`tsc -b` + `tsc-alias`).

### Variables de entorno de la API

Las de `apps/api/.env.example`. En producción, además:

- `DATABASE_URL` en **puerto 6543** (Supavisor, modo transacción) y
  `DATABASE_POOL_MAX=1`: cada instancia de Vercel abre su propio pool.
- `CORS_ORIGIN` con el dominio del frontend; admite lista separada por comas y
  `*` como comodín (`https://psicoagenda-web-*.vercel.app`) para los previews.
- `CRON_SECRET`: sin él, `POST /api/internal/despachar` responde 503.

### Migraciones

Vercel no tiene pre-deploy: se aplican a mano antes de desplegar.

```bash
npm run prisma:migrate:deploy --workspace=apps/api
npx prisma db execute --file apps/api/prisma/supabase/grants.sql
```

### Notificaciones: el `setInterval` no existe en serverless

En un proceso de larga vida (`npm run dev`, Railway, una VM) los avisos los
dispara `iniciarDespachador()` cada minuto. En Vercel no hay proceso que viva
entre peticiones, así que el barrido lo llama un cron externo:

```bash
curl -X POST https://psicoagenda-api.vercel.app/api/internal/despachar \
  -H "Authorization: Bearer $CRON_SECRET"
```

El endpoint es idempotente con ejecuciones solapadas (reclamo optimista en la
tabla `notificaciones`). Mientras el cron no esté configurado, los recordatorios
se acumulan en `PENDIENTE` y salen todos en el primer barrido. La
configuración del cron vive en el ticket `TICKET-2026-10-27-cron-externo.md`.

Los códigos de registro viven en la tabla `cache_registro` y no en la memoria del
proceso, exactamente por la misma razón: con varias instancias, la verificación
puede caer en una lambda que nunca vio el código.


El desarrollo se gestiona con cambios propuestos antes de tocar código:

1. **Propose** — crear una propuesta de cambio:

```bash
openspec new change <YYYY-MM-DD-nombre-del-cambio>
```

   o desde `opencode` con el slash command `/opsx-propose`.

   > **El CLI no antepone la fecha.** `openspec new change` crea la carpeta con el
   > nombre tal cual, así que hay que incluir el prefijo `YYYY-MM-DD` a mano para
   > mantener el orden cronológico con los changes ya archivados. La fecha queda
   > además registrada en el campo `created:` del `.openspec.yaml` del change, que
   > es la fuente que consulta el resto de comandos.

2. **Spec** — rellenar `proposal.md`, `tasks.md`, `design.md` y los `specs/` delta del cambio.
3. **Validate** — `openspec validate <nombre-del-cambio>`.
4. **Apply** — implementar el código conforme a la especificación (`/opsx-apply`).
5. **Archive** — al terminar, archivar el cambio para integrar sus deltas en `openspec/specs/` (`/opsx-archive`).

## Requisitos clave (resumen)

- **Rendimiento:** operaciones < 3 s.
- **Escalabilidad:** mínimo 500 pacientes y 1000 citas.
- **Seguridad:** cifrado en tránsito/reposo, contraseñas cifradas fuera del sistema (Supabase Auth), 2FA delegado al proveedor, control de sesiones.
- **Disponibilidad:** 99% en horario laboral.
- **Privacidad:** cumplimiento de la Ley Federal de Protección de Datos Personales (México).
- **Infraestructura:** respaldo en AWS.
- **Dominio:** citas de 45–60 min, tutores legales para menores, código ético APA, contacto de emergencia obligatorio, retención y portabilidad de datos.
