# Proposal

## Why

El formulario de "Solicitar cita" y "Nueva cita" arranca con la fecha de hoy y la hora 10:00 aunque la persona no haya elegido nada. Si la fecha es hoy, muestra franjas que ya pasaron (la API recién las rechaza al enviar) y un paciente puede solicitar una cita para el mismo día. Tampoco hay una señal visual de si el día elegido tiene horarios libres, está lleno o no tiene horario.

## What Changes

- **Sin fecha predefinida**: los flujos de cita nueva arrancan sin fecha ni hora; la fecha y la hora solo aparecen cuando la persona elige. La edición y los enlaces con `?fecha=` conservan sus valores.
- **Regla de hoy**: el paciente solo puede solicitar desde **mañana** (el botón "Hoy" desaparece y una fecha de hoy se ajusta a mañana). El psicólogo puede agendar hoy; la edición conserva la fecha de la cita.
- **Horas pasadas**: cuando la fecha es hoy, se ocultan las franjas que ya empezaron. La franja de una cita en edición se mantiene visible.
- **Color de disponibilidad**: el preview de la fecha se pinta en verde si hay horarios libres, ámbar si el día está completo y rojo si no tiene horario. Incluye texto y leyenda, no solo color.
- **Día lleno**: no se preselecciona ninguna franja ocupada y no se muestra el costo hasta que haya una franja libre.

## Capabilities

### Modified Capabilities

- `appointment-management`: reglas de fecha y disponibilidad al solicitar o agendar una cita.

### New Capabilities

(None)

## Impact

- `apps/web/src/app/(app)/agenda/components/appointment-form.tsx`: estado sin fecha, mínimos por rol, filtro de horas pasadas, estado/color y validaciones.
- `apps/web/src/lib/citas.ts`: reglas puras de fecha, mínimo, filtro y estado.
- `apps/web/tests/citas.test.ts`: pruebas de las reglas.
- Sin cambios de API ni de base de datos: la API sigue rechazando horarios pasados.
