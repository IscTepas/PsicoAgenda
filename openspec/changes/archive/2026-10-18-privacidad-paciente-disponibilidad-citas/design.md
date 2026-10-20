# Design: Ocultar tarjeta del paciente en rol paciente y sugerir próximo día disponible cuando no haya franjas

## Contexto técnico

- El formulario de cita (`appointment-form.tsx`) detecta el rol efectivo con `useSession()` y `UserRole`, derivando `isPatient`.
- La selección de paciente (Card 1) se renderiza solo cuando `!isPatient` (línea ~674); cuando es paciente, `lockedPatientId` se deriva de `patients[0]?.id` (su propio registro acotado por la API).
- Las franjas horarias (`availableHours`) se calculan a partir del `PsychologistSchedule` del profesional (BD o fallback `FALLBACK_HOURS` Lun–Vie 09:00–19:00), filtrado por día de semana con mapeo JS (0=domingo→7=BD).
- `slotAvailability` marca cada hora como disponible u ocupada según las citas del día (`appointmentService.list` con `from`/`to` del día seleccionado).
- `nextAvailableDate` busca el primer día futuro (1–30 días) cuyo día de semana tenga horarios configurados en el schedule del profesional.

## Decisiones

1. **Ocultar Card 1 por rol, no por dato.** La tarjeta de selección de paciente se omite enteramente para `isPatient`; el paciente no elige paciente, se le asigna su propio perfil. Alternativa descartada: mostrar la tarjeta deshabilitada, porque añade ruido visual sin utilidad para el paciente.

2. **Sugerir próximo día con horarios configurados, no necesariamente con hora libre.** `nextAvailableDate` valida que el día tenga franjas en el schedule del profesional; si el día tiene franjas pero todas ocupadas, el usuario aún verá "Ocupado" por franja. Esto es intencional: sugiere días hábiles del profesional, no disponibilidad en tiempo real contra la BD (esa verificación ya ocurre por franja en `slotAvailability`).

3. **Mapeo de día de semana.** JS `getDay()` (0=domingo..6=sábado) se convierte a BD (`1=lunes..7=domingo`) para coincidir con `PsychologistScheduleSlot.dayOfWeek`.

4. **Navegación al día sugerido.** Al hacer clic en "Ir al <día>", se actualiza `selectedDate`, `dateInputValue` y se recargan las citas del día (`useEffect` sobre `selectedDate`), mostrando las franjas de ese día.

## Enfoque por archivo

- `appointment/components/appointment_form.tsx`:
  - Card 1 (`Paciente de la Consulta`) envuelta en `{!isPatient && ...}`.
  - Bloque "no tiene horarios disponibles" muestra `nextAvailableDate` y botón `Ir al <día>` que llama a `setSelectedDate` + `setDateInputValue`.

## Validation

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (web).
- Smoke dev: abrir `/agenda/nueva` con rol psicólogo → ver Card 1; abrir con rol paciente → no ver Card 1, paciente propio preseleccionado.
- Smoke dev: elegir un sábado / día sin horarios → aparecer "no tiene horarios disponibles" + botón "Ir al <día>" que navega al próximo día hábil con franjas.
