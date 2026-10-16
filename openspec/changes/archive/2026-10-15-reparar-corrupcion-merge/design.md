# Design: Reparar la corrupción del merge en `main`

## Decisions

1. **El esquema de `Christian` es la fuente de verdad del modelo de datos.**
   - Se regenera el cliente Prisma en lugar de revertir el esquema, porque `schema.prisma` (nombres en español, `@@map`) es el estado deseado y ya usado por migraciones.

2. **Se preserva el *render* de `main` en la web y se restaura lo que el merge eliminó.**
   - Se prefieren cambios quirúrgicos que recompongan ambos lados, en vez de reemplazar archivos completos por una rama.

3. **El script de tema se inyecta con `next/script` (`beforeInteractive`), no con `<script>` crudo.**
   - React 19 advierte al renderizar `<script>` dentro de un componente; `next/script` es el mecanismo soportado y to hoistea al `<head>` evitando el *flash* de tema.

4. **La hidratación se resuelve con `useSyncExternalStore`, no con `useEffect` + `setState`.**
   - La regla `react-hooks/set-state-in-effect` (React Compiler) prohíbe `setState` síncrono en un *effect*; `useSyncExternalStore` da un *snapshot* de servidor estable (`false`/`"system"`) y evita el *mismatch*.

5. **El flag de guardado se unifica en `isSubmitting`** (nombre del *render* de `main`), eliminando el `isSaving` de `Christian` que ya no se leía.

## Cambios por archivo

### `apps/web/src/app/layout.tsx`
- Se elimina `<head>` y los `<script>` inline; se añade `<Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={THEME_INIT_SCRIPT} />` dentro de `<body>`.

### `apps/web/src/lib/use-hydrated.ts` (nuevo)
- `useSyncExternalStore(subscribeNoop, () => true, () => false)` para distinguir SSR/primera hidratación de cliente montado.

### `apps/web/src/lib/use-theme.tsx`
- Lectura de `localStorage` con `useSyncExternalStore` (`getServerSnapshot` = `"system"`); `applyTheme` en `setTheme` y en cambios de otra pestaña (`storage`).

### Hidratación de valores temporales
- `components/ui/calendar.tsx`: `today` es `null` hasta montar.
- `app/(app)/pacientes/[id]/patient-clinical-record.tsx`: `age` sólo con hidratación.
- `app/(app)/dashboard/dashboard-view.tsx`: *skeleton* por `useHydrated` en ambas vistas; `today`/`clock` gated.
- `app/(app)/agenda/components/appointment-form.tsx`: `isAppointmentToday` requiere hidratación.

### Reparación de símbolos del merge (web)
- `agenda-client.tsx`: importar `Loader2`; usar `isLoadingData` en el indicador del encabezado.
- `dashboard-view.tsx`: restaurar import de `@/lib/mock-data` (`MOCK_APPOINTMENTS`, `MOCK_PSYCHOLOGIST`, `getPatientById`, `getPatientForUser`, `getLatestHomeworkForPatient`) y pasar `patientById` a `<DayTimeline>`; retirar estado muerto `isDataLoading`/`loadError`.
- `appointment-form.tsx`: agregar import `Loader2` y `MOCK_PSYCHOLOGIST`; helper `toDate`; estado real `dayAppointmentsLoading` (efecto en `async`); eliminar estado duplicado y `currentPatientId`; unificar `isSubmitting`; eliminar `buildStartTime` muerto.

### `apps/api` (Prisma)
- `prisma generate` para realinear `src/generated/prisma` con `schema.prisma`.

## Validation

- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build` (web)
- `openspec validate 2026-10-15-reparar-corrupcion-merge`
