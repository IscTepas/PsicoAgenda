# Proposal

## Why

La agenda del psicólogo solo conoce las citas: los huecos libres son, por definición, todo lo que no está ocupado. Eso no refleja la realidad. Un congreso, unas vacaciones o un trámite bloquean horas en las que el profesional no atiende, pero el sistema sigue ofreciéndolas y acepta citas o solicitudes encima. El profesional no tiene forma de declarar esa indisponibilidad y el paciente descubre el conflicto cuando ya reservó.

## What Changes

- SHALL existir un registro de bloqueos de agenda por psicólogo, con inicio, fin, bandera de día completo y motivo opcional.
- El psicólogo SHALL poder crear y eliminar sus propios bloqueos; ningún otro rol SHALL poder hacerlo.
- El sistema SHALL rechazar con `409` cualquier cita o solicitud que se cruce con un bloqueo del psicólogo, en todos los caminos de escritura (alta, reprogramación, aceptación de solicitud y nueva solicitud).
- Dos bloqueos del mismo psicólogo SHALL NOT solaparse, incluso ante peticiones concurrentes.
- La agenda SHALL mostrar los bloqueos en las vistas de día, semana y mes como elementos no interactivos, y SHALL ofrecer un diálogo aparte para gestionarlos.
- El paciente SHALL poder consultar los bloqueos del psicólogo que lo atiende para conocer su disponibilidad.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `appointment-management`: se añade el bloqueo de agenda como restricción de disponibilidad que impide agendar y que se representa en el calendario.

## Impact

- **Base de datos**: tabla `bloqueos_agenda` con FK a `psicologos`, índice por psicólogo y fecha, `CHECK` de rango válido y `EXCLUDE` de solape entre bloqueos.
- **API**: endpoints `POST`, `GET` y `DELETE /api/bloqueos`; guard de solape en las escrituras de cita y solicitud; error `AGENDA_BLOQUEADA` con detalles del bloqueo.
- **Web**: botón «Bloquear agenda», modal de alta, diálogo de gestión y tarjetas de bloqueo en las vistas de día, semana y mes.
- **Shared**: tipo `AgendaBlock` y esquemas de validación de alta y de rango de consulta.
- **Fuera de alcance**: bloqueos recurrentes, edición de un bloqueo existente (se elimina y se crea de nuevo) y bloqueo desde la ficha del paciente.
