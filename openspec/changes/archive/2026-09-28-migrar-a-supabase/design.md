## Context

Estado actual relevante (el resto está en `proposal.md`):

- `apps/api/prisma/schema.prisma` ya tiene los 15 modelos del dominio con `provider = "postgresql"` y `@@map` a tablas snake_case. La migración `20260927000000_baseline` existe pero se generó con `migrate diff --from-empty` y **nunca se aplicó**.
- `apps/api/src/lib/prisma.ts` crea el `PrismaClient` con `new PrismaPg({ connectionString })`, pero **ningún route lo importa**. La API completa corre sin tocar la base de datos.
- `apps/api/prisma.config.ts` resuelve la URL con `datasource.url = env("DATABASE_URL")`. En Prisma 7 el bloque `datasource` de `prisma.config.ts` admite solo `url` y `shadowDatabaseUrl` (ya no existe `directUrl`).
- La autenticación propia usa `jsonwebtoken` con `JWT_SECRET`; `bcrypt` está instalado pero nunca importado. El modelo `TwoFactorAuth` existe sin servicio ni endpoint.
- La máquina de desarrollo **no tiene IPv6 global**, lo que descarta la conexión directa a Supabase.

## Goals / Non-Goals

**Goals:**

- Conectar de forma verificable a la base de datos por primera vez y poder aplicar el esquema.
- Garantizar cifrado en tránsito hacia la base de datos y verificación criptográfica de tokens sin secreto compartido.
- Retirar toda ruta que storage o resuelva contraseñas, y el modelo que duplica el segundo factor.
- Dejar una frontera explícita entre lo que Prisma administra y lo que Supabase administra.

**Non-Goals:**

- No se adoptan Supabase Storage, Realtime, Edge Functions ni la Data API. Se usan solo PostgreSQL y Auth.
- No se implementa la verificación real de correo ni el flujo de recuperación en el backend: los resuelve Supabase Auth; este change solo los conecta.
- No se construye la autorización por rol en el backend más allá de what's ya existe (`requireRole`), que hasta hoy no se aplica a ninguna ruta.
- No se migra la interfaz completa: `mock-data.ts` sigue alimentando las pantallas que no son login/registro.

## Decisions

### 1. Supabase aporta el PostgreSQL; el motor y el esquema no cambian

Se mantiene `provider = "postgresql"`, el cliente `prisma-client` y `@prisma/adapter-pg`. Los 15 modelos se mantienen tal cual salvo `User` y la eliminación de `TwoFactorAuth`.

**Alternativa considerada:** migrar a `supabase-js` + PostgREST como capa de acceso, descartando Prisma. Se rechaza porque obligaría a reescribir toda la capa de acceso a datos contra una API REST, perdería tipado de retorno en tiempo de compilación y haría la autorización más difusa. Prisma habla SQL directo; Supabase lo expone sin capas intermedias.

### 2. Conexión: Supavisor en modo sesión

Se usa `aws-0-<region>.pooler.supabase.com:5432`, no la conexión directa `db.<ref>.supabase.co:5432`.

El modo directo es IPv6 y no es alcanzable desde este entorno. El modo transacción (puerto 6543) queda descartado porque **no soporta sentencias preparadas**, que Prisma emite por debajo; obligaría a añadir `pgbouncer=true` y a perder el caché de planes preparados.

El modo sesión es el que recomienda la guía oficial de Supabase para backends persistentes.

### 3. TLS y pool: `PoolConfig` explícito en lugar de una string

`src/lib/prisma.ts` deja de pasar una string y pasa un objeto `pg.PoolConfig`. Tres razones, todas verificadas contra las versiones instaladas:

- El default de `pg` es `ssl: false`. Sin configuración explícita la conexión **va en texto plano**, lo que incumple el requisito de cifrado en tránsito.
- El `pg-connection-string` instalado trata `sslmode=prefer`, `require` y `verify-ca` como **alias de `verify-full`**, es decir, valida el certificado contra el almacén del sistema. La cadena de Supabase no está firmada por una CA pública, así que eso falla con `SELF_SIGNED_CERT_IN_CHAIN`. El valor que desactiva la verificación en este driver es `sslmode=no-verify`, que no es un parámetro de libpq.
- Si la string contiene `sslcert`, `sslkey`, `sslrootcert` o `sslmode`, el objeto `ssl` del config **se sobrescribe** al parsear. Documentado en node-postgres.

Se opta por `ssl: { rejectUnauthorized: false }` y se deja anotado el endurecimiento a `verify-full` con el `root.crt` que Supabase publica en el dashboard. La validación de identidad del servidor se delega a la cadena TLS del proveedor, que ya es un riesgo aceptado de la plataforma.

El tamaño del pool se fija explícitamente. `pg` usa `max: 10` y Supavisor en modo sesión tiene un "Pool Size" por defecto acotado por combinación base-de-datos+rol: con más de una instancia del API, el límite se agota con facilidad.

### 4. Rol `prisma` dedicado con `bypassrls` y `createdb`

El bootstrap en SQL se versiona en `apps/api/prisma/supabase/bootstrap.sql` para que sea reproducible y revisable.

- `createdb` es indispensable: `@prisma/adapter-pg` implementa `connectToShadowDb()` creando `prisma_migrate_shadow_db_<uuid>` en el mismo servidor. Sin ese atributo, `migrate dev` falla.
- `bypassrls` hace explícita la intención de que la API no queda sujeta a políticas RLS. La API es la única vía de acceso a los datos, y su autorización vive en `requireRole`; aplicar RLS sobre el mismo rol que escribe no aportaría nada.
- El rol `postgres` de Supabase no es superuser (Supabase le retiró el privilegio por un parche de seguridad) y no es dueño de los objetos de `public`. PostgreSQL 15 quitó el `CREATE` por defecto sobre `public` para `PUBLIC`, de modo que los `grant` explícitos son obligatorios, no cosméticos.

**Alternativa considerada:** usar el rol `postgres` directamente. Se descarta por visibilidad en los logs de la plataforma y por acoplar el modelo a un rol que Supabase modifica.

### 5. Verificación de tokens con `jose` y JWKS

El backend **no emite** tokens. Se elimina `signToken` y `JWT_SECRET` desaparece del entorno.

`verifyToken` pasa a `jwtVerify` con `createRemoteJWKSet` sobre `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`, validando `issuer` (`https://<ref>.supabase.co/auth/v1`) y `audience` (`authenticated`). `createRemoteJWKSet` cachea en memoria con su propia política de revalidación, así que no hay ida al servidor de Auth por request.

**Alternativas consideradas:**

- `supabase.auth.getUser(token)`: válido, pero es una ida a la red por request y con firma simétrica es la única opción. Se descarta por latencia.
- `jsonwebtoken` con el secreto simétrico de Supabase: funcionaría, pero Supabase ya no lo recomienda y obliga a distribuir el secreto a cada backend. Se descarta.

ElJWKS es la vía correcta porque los proyectos nuevos usan claves asimétricas por defecto, y es lo que permite rotar y revocar claves sin desplegar.

**Consecuencia asumida:** si el proyecto se configuró con el secreto simétrico legado, `jwtVerify` contra el JWKS no validará. Se documenta en el README que hay que migrar a claves de firma en el dashboard.

### 6. El rol de negocio viaja en `app_metadata.role`

El claim `role` del JWT de Supabase es `authenticated` (un rol de PostgreSQL) y **no** es el rol de negocio. El rol de negocio se lee de `app_metadata.role`, que el cliente no puede modificar; `user_metadata` sí es editable por el usuario y queda descartado.

El perfil se lee de `public.users` en `GET /api/auth/me`; la autorización de los endpoints usa el claim, sin consulta a la base de datos por request.

**Consecuencia asumida:** revocar un rol o banear a un usuario no surte efecto hasta que el token de acceso vence (1 hora por defecto). Es la contrapartida de no consultar la base en cada request, y es exactamente la razón por la que los tokens de acceso son cortos.

### 7. `public.users` es un perfil espejado por triggers, no una fuente de identidad

Los `id` de `public.users` son los UUID de `auth.users`, sin `@default(uuid())`. Un trigger `AFTER INSERT OR UPDATE` sobre `auth.users` inserta y actualiza `email`, `is_active` (a partir de `banned_until`) y `last_login_at`.

**Alternativas consideradas:**

- FK a `auth.users`: imposible. `auth` pertenece a Supabase y un trigger de mantenimiento puede alterar sus columnas. Es además drift waiting to happen.
- Consultar `auth.users` por la Data API desde el backend: acopla la API a PostgREST, necesita la `service_role` y suma una ida a la red por usuario.

El precio es que `email` queda duplicado en dos schemas. Se acepta: es el patrón oficial y mantiene las consultas existentes por Prisma sin cambios.

`TwoFactorAuth` se elimina. MFA vive en `auth.mfa_factors`, y guardar un secreto TOTP en `public` sería una segunda copia del factor de autenticación con auditoría y rotación distintas.

### 8. Se edita la migración baseline en lugar de encadenar una correctiva

La baseline no está aplicada en ningún entorno y no hay datos que preservar. Enlazarla con un `DROP COLUMN password_hash` y un `DROP TABLE two_factor_auth` dejaría el historial con un estado que nunca existirá en ninguna base. El change `alinear-dominio-shared-prisma` ya justificó cerrar relaciones "aprovechando que aún no hay migraciones aplicadas"; este aplica el mismo criterio.

**Consecuencia:** si alguien llegara a aplicar la baseline antes de este change, habría que regenerarla. Se documenta en el README que el orden es bootstrap → aplicar este change.

### 9. La Data API de Supabase se desactiva

El schema `public` no tiene RLS. Con la Data API activa, la clave `anon` permite leer `clinical_records`, `log_entries` y `patients` sin pasar por la API y sin `requireRole`. La recomendación de la propia guía de Supabase para un proyecto que solo usa Prisma es desactivar la Data API.

**Alternativa considerada:** mantener la Data API y activar RLS con políticas de deny-all. Se descarta porque añade superficie y mantenimiento sin aportar protección real: el rol `prisma` es dueño de las tablas y `bypassrls`, así que las políticas no se aplicarían a la API de todos modos. La frontera real es que solo el backend habla con la base.

### 10. Triggers en archivos de migración, fuera de `schema.prisma`

Prisma documenta explícitamente el patrón de editar `migration.sql` para añadir funciones `$$` que el lenguaje de esquema no puede expresar. Los triggers sobre `auth.users` nunca se referencian desde `schema.prisma`, porque hacerlo produciría drift en cada `migrate dev`.

Advertencia operativa: `@prisma/adapter-pg` implementa `executeScript` partiendo el script por `;`. Los cuerpos `$$` son seguros en `migration.sql` (los aplica el motor de migraciones), pero **rompen** `prisma db execute` y el `seed`. Ningún archivo de esas rutas contendrá funciones PL/pgSQL.

### 11. Fechas en UTC

Todos los `DateTime` del esquema son `TIMESTAMP(3)` sin zona, y Supabase opera en UTC. `@prisma/adapter-pg` formatea con los getters UTC (`getUTCFullYear`, etc.), así que el valor almacenado es UTC de forma consistente. Se fija el criterio: **se almacena UTC, se convierte en la presentación**, y no se mezclan horas locales en los datos.

## Risks / Trade-offs

- **`migrate dev` contra Supabase** → Supabase tuvo un bug donde crear y eliminar la base sombra fallaba con `statement timeout` (resuelto con pg_net 0.7, desplegado por fases). Mitigación: el bootstrap deja `shadowDatabaseUrl` documentado y apuntando a un segundo proyecto como plan B. Alternativa estable: `prisma migrate diff` + `migrate deploy`.
- **Límite de conexiones** → [Supavisor modo sesión con pool acotado; `pg` abre 10 conexiones por instancia] → `max` explícito y documentado, más un límite documentado de instancias.
- **Token verifies contra JWKS pero el proyecto usa secreto simétrico** → [todos los requests fallan con 401] → el README documenta el paso a claves de firma y `verifyToken` falla explícitamente, nunca degrada a un rol por defecto.
- **Ventana de hasta 1 hora tras revocar un rol o banear** → [el usuario conserva acceso temporal] → aceptado a cambio de no consultar la base por request; el refresco de Supabase reemite el token.
- **`email` duplicado entre `auth.users` y `public.users`** → [pueden divergir si el trigger falla] → los tres triggers (`INSERT`, `UPDATE`, `DELETE`) en un solo archivo, y `email` no es campo editable desde la API.
- **Pruebas sin base de datos** → [la suite actual no cubre nada que toque Prisma, porque nada lo toca] → los servicios se prueban con `vi.mock("@/lib/prisma")`; la integración contra una base real queda para un proyecto Supabase dedicado.
- **Degradación de rol silenciosa** → [el código actual hace `role ?? UserRole.PATIENT`; con Supabase un claim ausente degradaría a paciente] → `verifyToken` falla cerrado ante un token sin `app_metadata.role`.

## Migration Plan

1. Crear el proyecto en Supabase y el rol `prisma` ejecutando `prisma/supabase/bootstrap.sql` en el SQL Editor. La contraseña generada se entrega **solo** por variable de entorno.
2. Migrar el proyecto a claves de firma asimétricas desde el dashboard (Authentication → Signing Keys) y desactivar la Data API.
3. Configurar `.env` de `apps/api` y de `apps/web` con las variables de `proposal.md`.
4. Aplicar el esquema con `npm run prisma:migrate --workspace=apps/api` (o `migrate deploy` si la base sombra no está disponible) y ejecutar `prisma generate`.
5. Verificar la conexión con `GET /api/health` extendido para reportar la base de datos.
6. Desplegar el frontend y comprobar el flujo de registro → verificación de correo → login → `GET /api/auth/me`.

**Rollback:** no hay datos que perder, porque es la primera aplicación del esquema. El rollback consiste en restaurar los archivos de `schema.prisma` y las variables de entorno previos, y descartar el proyecto de Supabase. Por eso importa haber hecho el bootstrap del rol antes de la primera migración.
