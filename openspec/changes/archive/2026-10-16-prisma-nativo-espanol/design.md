# Design: Esquema Prisma nativo en español y API adaptada

## Contexto técnico

- Base viva: PostgreSQL/Supabase, proyecto `fjmgypvqbvngycvrdptj` (ca-central-1),
  accesible por el *pooler* `aws-1-ca-central-1.pooler.supabase.com:5432`. Prisma
  7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`). `prisma.config.ts`
  (intacto) resuelve `datasource.url` desde el entorno; no hay shadow database.
- La carpeta `apps/api/prisma/` se borró en disco y se restauró con
  `git restore apps/api/prisma` (10 archivos: `schema.prisma`, `seed.ts`,
  `migration_lock.toml`, migraciones y `supabase/*.sql`). `demo_accounts.sql` estaba
  sin rastrear y se recuperó desde la Papelera.
- Un `db pull` previo expuso que la base declara constraints `EXCLUDE`
  `excl_citas_paciente_sin_empalme` / `excl_citas_psicologo_sin_empalme` y 17 CHECKs
  `ck_*`, además de un índice único parcial `ux_contacto_principal` en
  `contactos_emergencia`. Refuerza que la base, no la migración base, es la
  autoridad.
- El contrato de la API vive en `packages/shared` en inglés
  (`Appointment`, `ClinicalRecord`, enums `AppointmentStatus`, `UserRole`, ...) y lo
  consume `apps/web`. Solo `apps/api` depende del cliente Prisma.

## Decisions

1. **Regenerar el esquema con `prisma db pull` (español nativo), no reescribir a
   mano.**
   - La base ya usa vocabulario español consistente; mantenerlo elimina la traducción
     y la posibilidad de que `@map` se desincronice. Alternativa descartada:
     conservar los `@map` y solo renombrar el cliente (duplica nombres y no resuelve
     el desalineamiento).

2. **Ajustes deliberados tras `db pull`, porque el introspector no los puede
   inferir:**
   - Reaplicar `@updatedAt` a las 5 columnas `actualizado_en` (`usuarios`, `citas`,
     `expedientes_clinicos`, `entradas_bitacora`, `pagos_honorarios`): son `NOT NULL`
     sin default; sin `@updatedAt`, los `create` fallarían.
   - Devolver `contactos_emergencia` a 1:N: `db pull` la colapsó a 1:1 por el índice
     único parcial `ux_contacto_principal`; el dominio permite varios contactos con
     uno marcado como principal (`pacientes.contactos_emergencia[]`).
   - Conservar `previewFeatures = ["partialIndexes"]`, necesario para el índice
     parcial `idx_notificaciones_pendientes`.

3. **Doble vocabulario explícito, con la frontera en el servicio.**
   - El esquema usa las claves de la base (`CONFIRMADA`, `PSICOLOGO`); el contrato
     compartido usa los valores de la interfaz (`confirmed`, `psychologist`). Cada
     servicio traduce en un único punto (`toSharedStatus`/`toSchemaStatus`, etc.) con
     `switch` exhaustivo; nunca se asume que ambos vocabularios coinciden por nombre.

4. **El claim JWT se desacopla del enum de la base.**
   - `utils/jwt.ts` compara literales en inglés (`PSYCHOLOGIST`/`PATIENT`/`ADMIN`)
     sin importar `rol_usuario`. El proveedor de identidad emite el claim en inglés;
     acoplarlo al enum español rompería la autorización ante cualquier cambio de
     vocabulario en cualquiera de los dos lados.

5. **La restricción de solape admite dos defensas.**
   - `assertNoOverlap` (consulta previa dentro de la transacción) da el mensaje en
     español; `normalizeOverlapError` traduce el fallo del constraint `EXCLUDE`
     (23P01) de la carrera concurrente a un `409`. Los nombres de constraint usados
     son los de la base (`excl_citas_*_sin_empalme`).

## Enfoque por archivo

- `apps/api/prisma/schema.prisma`: `db pull` + ajustes; `prisma validate/format/
  generate` en verde; cliente en `src/generated/prisma`.
- `apps/api/src/utils/jwt.ts`: vocabulario del claim en inglés, sin importar
  `rol_usuario`.
- `apps/api/src/services/auth.service.ts`: `prisma.usuarios`, `rol_usuario` →
  `UserRole`.
- `apps/api/src/services/psychologist.service.ts`: `prisma.psicologos`,
  `psicologosInclude`/`psicologosGetPayload`, `Prisma.usuariosUpdateInput`.
- `apps/api/src/services/patient.service.ts`: `prisma.pacientes`, incluye
  `usuarios`/`tutores_legales`/`contactos_emergencia`; `PatientProfile` mapea a
  `PatientProfile` compartido.
- `apps/api/src/services/appointment.service.ts`: `prisma.citas`,
  `citasModel`/`citasWhereInput`, traducción de `estado_cita`/`modalidad_cita`/
  `tipo_sesion`, `assertNoOverlap` + `normalizeOverlapError`.
- `apps/api/src/services/log-entry.service.ts`: `prisma.entradas_bitacora`,
  `entradas_bitacoraInclude`/`GetPayload`, relación `citas`/`psicologos`/
  `expedientes_clinicos`, versionado.
- `apps/api/src/services/clinical-record.service.ts`: `prisma.expedientes_clinicos`,
  `estado_expediente`.
- `apps/api/src/services/notification.service.ts`: `prisma.notificaciones`,
  `estado_envio`/`canal_notificacion`.
- `apps/api/tests/*`: dobles de Prisma y filas de ejemplo con los nombres en español
  (`citas`, `pacientes`, `psicologos`, `usuarios`, `registros_auditoria`).
- `apps/api/prisma/supabase/demo_accounts.sql`: restaurado (ya era español nativo).

## Validation

- `npx prisma validate`, `npx prisma format`, `npx prisma generate`.
- `npm run typecheck`, `npm run lint`, `npm test` (api 60, web 11), `npm run build`.
