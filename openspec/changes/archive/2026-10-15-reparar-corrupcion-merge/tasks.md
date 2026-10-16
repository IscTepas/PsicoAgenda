# Tasks: Reparar la corrupción del merge en `main`

- [x] Diagnosticar el warning de React (`<script>` crudo) y la causa raíz (corrupción del merge `8c6e8d6`).
- [x] `layout.tsx`: migrar el script de tema a `next/script` (`beforeInteractive`) y eliminar `<head>`/`<script>` crudos.
- [x] Crear `use-hydrated.ts` y migrar `use-theme.tsx` a `useSyncExternalStore`.
- [x] *Gating* de hidratación en calendario, expediente clínico, dashboard y formulario de cita.
- [x] `agenda-client.tsx`: importar `Loader2` y usar `isLoadingData`.
- [x] `dashboard-view.tsx`: restaurar import de `@/lib/mock-data` y prop `patientById`; retirar estado muerto.
- [x] `appointment-form.tsx`: reparar imports, `toDate`, `dayAppointmentsLoading`; unificar `isSubmitting`; eliminar estado/símbolos muertos.
- [x] `apps/api`: regenerar el cliente Prisma (`prisma generate`).
- [x] Validar monorepo: `typecheck`, `lint`, `test` (api + web).
- [x] Validar build de producción de `apps/web`.
- [x] Verificar dev server (`/`, `/login` → 200).
- [x] Validar change con OpenSpec CLI y archivarlo.
- [x] Crear espejo en Obsidian del proyecto.
