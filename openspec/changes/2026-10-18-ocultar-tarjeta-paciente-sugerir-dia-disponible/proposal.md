# Proposal

## Why

Cuando un paciente abre el detalle de una cita en la agenda, el diálogo ya oculta la tarjeta con sus datos personales (el cuerpo bifurca por `isPatient`), pero el **footer** muestra siempre el botón "Ver Expediente" al expediente clínico: se renderiza con solo comprobar `patient?.id`, sin mirar el rol. Eso ofrece al rol PACIENTE un enlace a la ficha clínica desde un lugar que no forma parte del flujo diseñado para ese rol. Además, los dos archivos que hay que tocar concentran los 5 errores de ESLint que hoy dejan el lint de `apps/web` en rojo, así que se corrigen en el mismo cambio.

## What Changes

- Ocultar el botón "Ver Expediente" del footer del diálogo de detalle de cita cuando el usuario autenticado tiene rol PACIENTE. El psicólogo/a lo sigue viendo igual.
- Corregir los 5 errores de ESLint preexistentes de `agenda-client.tsx` (3) y `appointment-form.tsx` (2), que son los archivos de este cambio.
- **Fuera de alcance (follow-up):** el bloque que sugiere el próximo día disponible cuando la fecha elegida no tiene franjas se queda **como está**; se rediseñará por completo en un cambio posterior (mostrar las franjas libres del día sugerido, descartar días llenos y mover fecha y hora al elegir una franja).

## Capabilities

### Modified Capabilities

- `appointment-management`: se añade el requisito de visibilidad del detalle de cita por rol. El sistema SHALL NO mostrar al rol PACIENTE tarjetas con información personal del paciente ni acciones de acceso al expediente clínico en el diálogo, y SHALL seguir mostrándolas al rol PSICOLOGO.

### New Capabilities

(None)

## Impact

- `apps/web/src/app/(app)/agenda/agenda-client.tsx`: guard `!isPatient` en el footer del diálogo y reubicación de los estados `paymentUpdating`/`paymentError` (lint).
- `apps/web/src/app/(app)/agenda/components/appointment-form.tsx`: solo correcciones de lint (estado derivado en lugar de sincronización por efecto); sin cambios de comportamiento.
- No se modifica el esquema de base de datos ni contratos de API.
