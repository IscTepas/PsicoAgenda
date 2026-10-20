# Tasks: Ocultar tarjeta del paciente en rol paciente y sugerir próximo día disponible cuando no haya franjas

- [x] Documentar el cambio con OpenSpec (proposal, design, tasks).
- [x] Confirmar ocultación de Card 1 "Paciente de la Consulta" para rol PATIENT en `appointment-form.tsx` (`{!isPatient &&`).
- [x] Confirmar `lockedPatientId` deriva de `patients[0]?.id` cuando `isPatient`.
- [x] Confirmar lógica `nextAvailableDate` (próximo día futuro con horarios del schedule, hasta 30 días).
- [x] Confirmar UI "no tiene horarios disponibles" con botón "Ir al <día>" que navega a `nextAvailableDate`.
- [ ] Verificar mapeo día de semana JS (0=domingo) → BD (7=domingo).
- [ ] Ejecutar `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (web).
- [ ] Smoke dev: rol psicólogo ve Card 1; rol paciente no la ve y usa su propio registro.
- [ ] Smoke dev: día sin franjas muestra sugerencia de próximo día disponible y navegación al clic.
