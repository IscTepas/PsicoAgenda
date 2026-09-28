# Proposal: Alinear dominio compartido con Prisma 7 y reparar relaciones faltantes

## Contexto

Durante el change `2026-09-26-planificar-arquitectura` se levantó el monorepo y el dominio completo en Prisma 7, pero `packages/shared` quedó con tipos originales que ya no coinciden con el schema. Además, se detectaron relaciones faltantes en `schema.prisma` (`InformedConsent.legalGuardianId` sin FK relacional, `Report.generatedById` y `LogEntry.psychologistId` sin relación).

## Objetivo

Mantener una única fuente de verdad entre `apps/api/prisma/schema.prisma` y `packages/shared/src/types/index.ts`, y cerrar las relaciones pendientes del modelo Prisma.

## Alcance

- Modificar `apps/api/prisma/schema.prisma`:
  - `InformedConsent` ↔ `LegalGuardian` (consentimiento del tutor de paciente menor).
  - `Report` → `User` (generado por).
  - `LogEntry` → `Psychologist` (psicólogo autor de la sesión).
- Actualizar `packages/shared/src/types/index.ts` para reflejar enums y campos de Prisma.
- Verificar que `npm run dev` funcione tras reparar junctions rotos por el cambio de carpeta.

## Out of scope / Non-goals

- No se aplican migraciones (no hay PostgreSQL disponible).
- No se ejecuta seed ni se cargan datos de ejemplo.
- No se cambia comportamiento funcional ni se agregan endpoints.
- No se reescriben specs del proyecto (`skip_specs: true`).

## Impacto esperado

- El frontend y el backend comparten tipos coherentes con la base de datos.
- Prisma `validate` y `generate` siguen funcionando.
- Se eliminan referencias huérfanas (`generatedById`, `psychologistId`) del schema.

## Riesgos y deuda técnica conocida

- `packages/shared/dist/index.js` emite exports sin extensión `.js`, lo cual es inválido en Node ESM nativo. Hoy no explota porque `routes/index.ts` solo monta health, pero fallará cuando se use `utils/jwt.ts` en una ruta. Se documenta para el siguiente change.
- `npm run dev` en clon limpio fallaría porque `packages/shared/dist` está gitignored; build/typecheck sí compilan shared, pero dev no. Se documenta para el siguiente change.
