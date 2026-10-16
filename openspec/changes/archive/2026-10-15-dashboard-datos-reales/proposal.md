# Proposal: Dashboard y vistas con datos reales de la API

## Why

Varias pantallas de la web siguen leyendo datos ficticios de `apps/web/src/lib/mock-data.ts` en lugar de la API (`appointmentService`, `patientService`, `psychologistService`, `logEntryService`, `clinicalRecordService`). Esto provoca datos inconsistentes (citas y pacientes inventados), estados imposibles y que el error real `GET /api/appointments 403` quede oculto tras información falsa. Además, la cuenta demo de psicólogo inicia sesión pero no tiene fila en `public.psicologos`, por lo que toda ruta de negocio le responde `403 Forbidden`.

## What Changes

- **Dashboard, vista psicólogo**: reemplazar el uso de `getPatientById` (mock) por el mapa real `patientById` ya cargado desde la API.
- **Dashboard, vista paciente**: eliminar `MOCK_APPOINTMENTS`, `MOCK_PSYCHOLOGIST`, `getPatientForUser` y `getLatestHomeworkForPatient`; cargar perfil (`patientService.getMe`), citas (`appointmentService.list`) y psicólogo (`psychologistService.getById`) desde la API. **Se elimina** la sección "Antes de tu sesión" (el paciente no puede leer la bitácora por API).
- **Detalle de paciente** (`pacientes/[id]`): dejar de leer mock; cargar paciente, citas, bitácora y expediente desde la API en cliente, y persistir altas/ediciones de bitácora con `logEntryService.create/update`. Se elimina la tarjeta de "Alergias" (no existe en el modelo `ClinicalRecord`).
- **Perfil** (`perfil`): cargar datos desde `psychologistService.getMe`/`patientService.getMe` y persistir con `updateMe`/`updateProfile` (hoy es una simulación con `setTimeout`).
- **Agenda** (`appointment-form`): eliminar `MOCK_PSYCHOLOGIST`; mostrar el psicólogo real del paciente o el texto genérico ya existente.
- **Corrección menor**: añadir `data-scroll-behavior="smooth"` al `<html>` para silenciar el aviso de Next.js sobre `scroll-behavior: smooth` en `globals.css`.
- **BD (script demo)**: ampliar `apps/api/prisma/supabase/demo_accounts.sql` para asegurar la fila `public.psicologos` del psicólogo demo y vincular `pacientes.psicologo_id`. Esto resuelve la causa raíz del `403`.
- **Eliminación**: borrar `apps/web/src/lib/mock-data.ts` cuando no queden imports.

## Capabilities

### New Capabilities
<!-- Ninguna: este cambio no introduce capacidades nuevas. -->

### Modified Capabilities
<!-- Ninguna: no cambian los requisitos a nivel de spec. Es un refactor de la web
     (dejar de usar datos ficticios) y un ajuste de datos demo. `skip_specs: true`. -->

## Impact

- Código web: `apps/web/src/app/(app)/dashboard/dashboard-view.tsx`, `pacientes/[id]/page.tsx`, `pacientes/[id]/patient-clinical-record.tsx`, `perfil/pantalla-perfil-usuario.tsx`, `agenda/components/appointment-form.tsx`, `apps/web/src/app/layout.tsx`, y eliminación de `apps/web/src/lib/mock-data.ts`.
- BD: `apps/api/prisma/supabase/demo_accounts.sql` (ejecución manual como `postgres`).
- Sin cambios en `schema.prisma`, migraciones ni endpoints de la API.
- La verificación end-to-end del `403` requiere ejecutar el SQL en Supabase (paso manual).
