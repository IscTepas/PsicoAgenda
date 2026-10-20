# Tasks

## 1. Ocultar el acceso al expediente para el rol PACIENTE

- [x] 1.1 Modificar `apps/web/src/app/(app)/agenda/agenda-client.tsx`: envolver el botón "Ver Expediente" del footer en `!isPatient` (la tarjeta del paciente ya estaba condicionada en el cuerpo), verificando que el psicólogo lo siga viendo
- [x] 1.2 Verificar con una prueba de UI (Playwright, cuentas demo reales) que el psicólogo ve "Ver Expediente" y el paciente no, sin perder "Cerrar" ni "Modificar Cita"
  - Ejecutada contra la web y la API reales (`psicologo.demo@example.com` / `paciente.demo@example.com`), con citas reales del proyecto: psicólogo → "Ver Expediente" y tarjeta del paciente presentes; paciente → sin "Ver Expediente", con "Profesional tratante" y ambos botones del footer.

## 2. Errores de ESLint preexistentes en los archivos del cambio

- [x] 2.1 `agenda-client.tsx`: mover `paymentUpdating`, `paymentError` y `selectedAppointment` antes del callback que los usa (3 errores de `react-hooks/immutability`)
- [x] 2.2 `appointment-form.tsx`: derivar `selectedHourEfectivo` y `durationMinutesEfectivos` y eliminar los dos efectos que sincronizaban estado (2 errores de `react-hooks/set-state-in-effect`)
- [x] 2.3 Verificar que `npx eslint` de los dos archivos queda sin errores y que `npm run lint` de `apps/web` termina con 0 errores (quedan 4 warnings preexistentes en `dashboard-view.tsx` y `pacientes/page.tsx`, ajenos a este cambio)

## 3. Verificación e integración

- [x] 3.1 Ejecutar `npm run typecheck` en `apps/web` y confirmar que no hay errores de TypeScript
- [x] 3.2 Ejecutar `npm run lint` en `apps/web` y confirmar que no hay errores de ESLint
- [x] 3.3 Ejecutar `npm run test` en `apps/web` y verificar que no hay regresiones en los tests existentes (34/34)
- [x] 3.4 Ejecutar `openspec validate "2026-10-18-ocultar-tarjeta-paciente-sugerir-dia-disponible" --strict` y confirmar que el change es válido

## Fuera de alcance (follow-up)

- Rediseñar la sugerencia del próximo día disponible cuando la fecha elegida no tiene franjas: hoy el comportamiento actual se mantiene (sugerir el día con horario definido + botón para navegar). El rediseño incluye mostrar las franjas libres del día sugerido, descartar días llenos y mover fecha y hora al elegir una franja.
- Proteger `/pacientes/:path*` por rol en `proxy.ts` si se quiere defensa en profundidad: hoy el proxy solo exige sesión y el acotamiento de datos lo hace la API.

## Workflow follow-up

- Archivar el cambio tras la revisión y `openspec validate` en verde.
