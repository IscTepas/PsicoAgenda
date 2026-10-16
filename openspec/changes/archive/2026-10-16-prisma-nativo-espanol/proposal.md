# Proposal: Esquema Prisma nativo en español y API adaptada

## Why

`apps/api/prisma/schema.prisma` describía el dominio con nombres en inglés
(`Appointment`, `Patient`, `Psychologist`, campos `startTime`, `patientId`, enums
`AppointmentStatus`...) y delegaba al motor la traducción a las columnas reales con
`@map`/`@@map`. La carpeta `apps/api/prisma/` se perdió en disco y se restauró desde
git, pero el esquema seguía sin corresponder línea a línea con la base viva
(PostgreSQL/Supabase, proyecto `fjmgypvqbvngycvrdptj`), que ya usa identificadores
nativos en español: tablas `usuarios`, `pacientes`, `citas`, `expedientes_clinicos`,
`entradas_bitacora`, `notificaciones`, y enums `estado_cita`, `rol_usuario`,
`modalidad_cita`, `tipo_sesion`, etc.

El doble vocabulario (modelo inglés + `@map` a columnas españolas) obligaba a
mantener dos nombres por concepto y a confiar en que `@map` no se desincronizara de
la base. Con el esquema sin `@map`, la base queda como única fuente de verdad.

## What Changes

Regenerar `schema.prisma` directamente desde la base de datos (`prisma db pull`) para
que modelos, campos y enums sean nativos en español, y adaptar `apps/api` al cliente
Prisma resultante. El contrato de la API (`@psicoagenda/shared`) y `apps/web` se
mantienen en inglés y **no** cambian.

## Alcance

- `apps/api/prisma/schema.prisma` regenerado con `prisma db pull`: **16 modelos y 13
  enums**, sin `@map`, más los ajustes deliberados que `db pull` no puede inferir.
- Reescritura de `apps/api/src` que depende del cliente Prisma: `utils/jwt.ts` y los
  servicios `auth`, `psychologist`, `patient`, `appointment`, `log-entry`,
  `clinical-record` y `notification`.
- Reescritura de las pruebas de `apps/api/tests` que tocan Prisma o el enum del
  esquema.
- Restauración del script `apps/api/prisma/supabase/demo_accounts.sql`.

## Out of scope / Non-goals

- No cambia el contrato de la API, ni `packages/shared`, ni `apps/web`.
- No se añaden migraciones: la base es la fuente de verdad y
  `prisma migrate diff --from-schema --to-config-datasource` está vacío.
- No se reescriben las specs del proyecto (`skip_specs: true`).

## Impacto esperado

- `schema.prisma` refleja la base viva sin traducción intermedia.
- La API compila y sus 60 pruebas pasan; `typecheck`, `lint` y `build` quedan verdes.
- El acceso demo de paciente y psicólogo conserva su respaldo de datos.

## Riesgos y deuda técnica conocida

- `prisma db pull` no reproduce `@updatedAt` ni la relación 1:N de
  `contactos_emergencia` (la base la declara con un índice único parcial): ambos
  ajustes se reaplicaron a mano y quedan documentados en `design.md`.
- El vocabulario del claim JWT (`PSYCHOLOGIST`/`PATIENT`/`ADMIN`) es inglés y es
  independiente del enum de la base `rol_usuario`; se desacopló a propósito para que
  un cambio de vocabulario en cualquiera de los dos no rompa la autorización en
  silencio.
