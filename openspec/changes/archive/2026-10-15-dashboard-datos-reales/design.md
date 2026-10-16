# Design: Dashboard y vistas con datos reales de la API

## Contexto técnico

- La API (`apps/api`) ya expone todo lo necesario: `/appointments` (filtra por rol: el psicólogo ve las suyas, el paciente las suyas), `/patients` (directorio/`me`), `/patients/:id/clinical-record`, `/patients/:id/log-entries`, `/psychologists/me`, `/psychologists/:id` (solo `requireAuth`, cualquier rol autenticado puede leer un perfil), `/notifications`.
- Servicios de la web (`apps/web/src/services`): `appointmentService`, `patientService`, `psychologistService`, `clinicalRecordService`, `logEntryService`, `notificationService`. Reviven fechas ISO a `Date`.
- `apiFetch` resuelve el token desde el cliente Supabase en el navegador; en SSR devuelve `null` y los Server Components deben inyectar `token` (vía `api-client.server.ts`). **`appointmentService.list` no acepta `token`**, así que el fetching dependiente de sesión se hace en el cliente.
- Autorización clínica: `requirePatientAccess` (`clinical-record.service.ts`) **rechaza a los PATIENT** con `forbidden`. Por eso la bitácora/expediente solo se consumen desde la vista del profesional y la sección de tareas del dashboard del paciente no puede alimentarse por API.
- El `403` en `GET /api/appointments` proviene de `requirePsychologistId`/`requirePatientId` cuando falta la fila de perfil (`public.psicologos` / `public.pacientes`), no del token ni de CORS.
- Esquema: `psicologos` = `id`, `usuario_id` (UNIQUE, FK `usuarios`), `cedula_profesional` (NOT NULL, UNIQUE), `especialidad`, `anios_experiencia` (>=0 o NULL), `biografia`. `pacientes.psicologo_id` (FK `psicologos`). No existe columna `allergies` en el modelo.
- `ClinicalRecord` = `diagnosis`, `background`, `generalObservations`, `status`, `openedAt`, `updatedAt` (sin `allergies`).

## Decisions

1. **Consumir la API en cliente para las vistas con sesión.**
   - Alternativa descartada: convertir páginas a Server Components y añadir `token` a `appointmentService.list`. Se prefiere el patrón ya usado por `pacientes/page.tsx` (fetch en cliente) para no ampliar la superficie de servicios.

2. **Eliminar la sección "Antes de tu sesión".**
   - El paciente no puede leer `log-entries` por API (`requirePatientAccess` → forbidden). Se elimina en lugar de exponer la bitácora clínica al paciente.

3. **Eliminar la tarjeta de "Alergias" del expediente.**
   - No existe en `ClinicalRecord`; el mock la inventaba. La tarjeta de diagnóstico conserva `diagnosis`, `background` y `generalObservations`.

4. **Bitácora persistente vía `logEntryService`.**
   - `create` asocia la cita y usa su fecha como `sessionDate`; `update` versiona. Estados de error/éxito locales se conservan.

5. **Resolver el `403` con datos, no con código.**
   - El script demo asegura `public.usuarios` (rol `PSICOLOGO`) y `public.psicologos` para `psicologo.demo@example.com`, y vincula al paciente demo. `ON CONFLICT (usuario_id) DO NOTHING` mantiene idempotencia; no pisa un `ADMIN`/`PSYCHOLOGIST` ya declarado en `auth.users`.

6. **Perfil con guardado real.**
   - `handleSavePreferences` llama `psychologistService.updateMe` / `patientService.updateProfile`; los campos se inicializan desde el perfil real (incluye `timeZone`).

## Enfoque por archivo

- `dashboard-view.tsx` (psicólogo): `patientById.get(...)` en las líneas que usaban `getPatientById`; guardas opcionales en el nombre.
- `dashboard-view.tsx` (paciente): estado de carga/error; `getMe`, `list`, `getById(profile.psychologistId)`; cancelar cita vía `appointmentService.cancel`; grid sin la sección de tareas.
- `pacientes/[id]/page.tsx`: guard de servidor (PATIENT → redirect) + pasar `patientId`.
- `patient-clinical-record.tsx`: fetch en cliente de paciente, citas, bitácora y expediente; persistencia de bitácora; sin `allergies`.
- `pantalla-perfil-usuario.tsx`: perfil real por rol + guardado real.
- `appointment-form.tsx`: sin `MOCK_PSYCHOLOGIST`.
- `layout.tsx`: `data-scroll-behavior="smooth"`.
- `mock-data.ts`: eliminado.

## Validation

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (api + web).
- Smoke dev: `/dashboard` con rol psicólogo y paciente; `/pacientes/[id]`; `/perfil`; `/agenda/nueva`.
- (Manual, tras ejecutar el SQL) `GET /api/appointments` responde `200` con la cuenta demo.
