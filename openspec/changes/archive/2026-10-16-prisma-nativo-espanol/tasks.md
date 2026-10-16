# Tasks: Esquema Prisma nativo en español y API adaptada

- [x] Restaurar `apps/api/prisma/` desde git y recuperar `demo_accounts.sql` desde la Papelera.
- [x] Regenerar `schema.prisma` con `prisma db pull` (16 modelos, 13 enums, sin `@map`).
- [x] Reaplicar `@updatedAt` a las 5 columnas `actualizado_en` y devolver `contactos_emergencia` a 1:N; conservar `previewFeatures = ["partialIndexes"]`.
- [x] `prisma validate` / `format` / `generate` en verde.
- [x] Adaptar `utils/jwt.ts` (claim en inglés, sin `rol_usuario`) y los servicios `auth`, `psychologist`, `patient`, `appointment`, `log-entry`, `clinical-record` y `notification` al cliente español.
- [x] Reescribir las pruebas de `apps/api/tests` que tocan Prisma (`appointment.service`, `patient.service`, `auth.me`, `database.integration`, `domain.integration`, `services.integration`, `jwt`) y verificar `tsc -p tsconfig.node.json`.
- [x] `npm run typecheck`, `npm run lint`, `npm test` (api 60, web 11) y `npm run build` en verde.
- [x] Documentar el cambio con OpenSpec (proposal, design, tasks) y validar con el CLI.
- [ ] Archivar el change.

> Nota: no se crea espejo en Obsidian por indicación expresa del usuario.
