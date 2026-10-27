# Proposal

## Why

El motivo de la consulta se guarda hoy como texto libre y opcional en `citas.motivo` y `solicitudes_cita.motivo`. Cada psicólogo escribe lo que quiere («ansiedad», «ansiedad generalizada», «trastorno de ansiedad»), así que no se puede filtrar, agrupar ni reportar por motivo, y tampoco detectar qué consultas son más frecuentes. El dato existe pero no sirve para decidir nada.

## What Changes

- SHALL existir un catálogo de motivos de consulta, administrable y con estado activo, organizado en categoría y motivo.
- La cita y la solicitud de cita SHALL referenciar un motivo del catálogo; la opción «Otro» SHALL exigir texto libre.
- El sistema SHALL NOT eliminar un motivo que esté en uso: solo desactivarlo para altas nuevas.
- Los motivos históricos SHALL conservarse tal como se registraron, sin reescribirlos.
- La captura SHALL ofrecer el catálogo como selector, no como campo de texto abierto.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `appointment-management`: se añade el catálogo de motivos de consulta como fuente del motivo en citas y solicitudes, con integridad para los motivos en uso.

## Impact

- **Base de datos**: tabla `motivos_consulta` y dos claves foráneas (`citas.motivo_id`, `solicitudes_cita.motivo_id`). Los campos de texto actuales se conservan para el caso «Otro» y para el histórico.
- **API**: endpoint de catálogo, validación de la referencia en los endpoints de cita y solicitud.
- **Web**: selector en «Solicitar cita» y «Nueva cita», visualización del motivo en el detalle.
- **Shared**: esquemas de validación del motivo.
- **Fuera de alcance**: reportes por motivo (se habilitan con este catálogo, pero su diseño va en un cambio aparte).
