# Tasks

## 1. Formulario

- [x] 1.1 Arrancar sin fecha ni hora en cita nueva; conservar edición y `?fecha=` / `?hora=`
- [x] 1.2 Calcular la fecha mínima por rol (paciente mañana, psicólogo hoy, edición sin mínimo) y ajustar una fecha anterior al mínimo
- [x] 1.3 Ocultar las franjas ya pasadas cuando la fecha es hoy, manteniendo la franja de la cita en edición
- [x] 1.4 Pintar el preview según disponibilidad (verde/ámbar/rojo) con texto y leyenda
- [x] 1.5 Preseleccionar solo franjas libres; si el día está lleno, sin selección ni costo
- [x] 1.6 Validar fecha, mínimo y horario futuro al enviar

## 2. Verificación

- [x] 2.1 Helpers puros en `lib/citas.ts` con pruebas de mínimo, filtro de horas pasadas y estados (web **77/77**)
- [x] 2.2 Playwright con endpoints simulados: paciente sin fecha, sin "Hoy", mañana en verde con 10 franjas y hoy ajustado a mañana; psicólogo con hoy y horas pasadas ocultas (14:00–18:00 a las 13:xx); día lleno en ámbar sin selección ni costo; día sin horario en rojo
- [x] 2.3 `typecheck` y `lint` sin errores

## Workflow follow-up

- Archivar el cambio tras la revisión y `openspec validate` en verde.
