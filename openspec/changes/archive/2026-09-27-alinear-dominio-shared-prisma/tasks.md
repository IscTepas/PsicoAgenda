# Tasks: Alinear dominio compartido con Prisma 7

- [x] Diagnosticar por qué `npm run dev` no resolvía `@psicoagenda/shared` (junctions rotos por movimiento de carpeta).
- [x] Reparar junctions de workspaces con `npm install` en la carpeta anidada.
- [ ] Actualizar `apps/api/prisma/schema.prisma`:
  - [ ] Relación `InformedConsent` ↔ `LegalGuardian`.
  - [ ] Relación `Report.generatedById` → `User`.
  - [ ] Relación `LogEntry.psychologistId` → `Psychologist`.
- [ ] Actualizar `packages/shared/src/types/index.ts` para reflejar enums y shape de Prisma.
- [ ] Ejecutar `prisma format`, `prisma validate`, `prisma generate`.
- [ ] Validar monorepo: `typecheck`, `build`, `lint`, `test`.
- [ ] Validar change con OpenSpec CLI.
- [ ] Archivar change y crear espejo Obsidian.
