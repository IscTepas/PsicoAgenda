# Tasks: Dashboard y vistas con datos reales de la API

- [x] Documentar el cambio con OpenSpec (proposal, design, tasks).
- [x] Ampliar `apps/api/prisma/supabase/demo_accounts.sql`: asegurar `public.usuarios` (rol `PSICOLOGO`) y `public.psicologos` del psicólogo demo + vincular `pacientes.psicologo_id`.
- [x] Dashboard vista psicólogo: reemplazar `getPatientById` por `patientById` (mapa real) y añadir guardas opcionales.
- [x] Dashboard vista paciente: cargar perfil/citas/psicólogo desde la API; eliminar `MOCK_*` y la sección "Antes de tu sesión"; cancelar cita vía servicio.
- [x] `pacientes/[id]/page.tsx`: guard de servidor y paso de `patientId` (sin mock).
- [x] `pacientes/[id]/patient-clinical-record.tsx`: fetch real de paciente/citas/bitácora/expediente y persistencia de bitácora; quitar tarjeta "Alergias".
- [x] `perfil/pantalla-perfil-usuario.tsx`: perfil real por rol + guardado vía servicios.
- [x] `agenda/components/appointment-form.tsx`: eliminar `MOCK_PSYCHOLOGIST`.
- [x] `app/layout.tsx`: añadir `data-scroll-behavior="smooth"`.
- [x] Eliminar `apps/web/src/lib/mock-data.ts` y verificar que no queden imports.
- [x] Verificar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` y smoke dev de las vistas afectadas.
- [ ] Aplicar `demo_accounts.sql` en Supabase (paso manual del usuario) y verificar `GET /api/appointments` → 200.
- [ ] Archivar el change (y `2026-10-15-cuentas-demo-bd`) y crear los espejos en Obsidian.
