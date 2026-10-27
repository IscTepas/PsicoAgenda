# Spec Delta

## ADDED Requirements

### Requirement: Motivo de consulta catalogado

El sistema SHALL ofrecer un catálogo administrable de motivos de consulta con estado activo, organizado en categoría y motivo, y la cita y la solicitud de cita SHALL referenciar un motivo del catálogo o la opción «Otro» acompañada de texto libre.

#### Scenario: Selección desde el catálogo

- **WHEN** un usuario programa una cita o solicita una cita
- **THEN** el sistema presenta los motivos activos agrupados por categoría y registra la referencia al motivo elegido

#### Scenario: Opción «Otro»

- **WHEN** el usuario elige «Otro»
- **THEN** el sistema exige un texto libre y lo conserva junto con la referencia a la opción genérica

#### Scenario: Motivo retirado del catálogo

- **WHEN** un motivo se desactiva
- **THEN** deja de ofrecerse en altas nuevas y las citas que ya lo usaban lo siguen mostrando sin cambios

### Requirement: Integridad del catálogo de motivos

El sistema SHALL NOT eliminar un motivo referenciado por alguna cita o solicitud y SHALL permitir desactivarlo para impedir nuevas selecciones.

#### Scenario: Intento de eliminar un motivo en uso

- **WHEN** se intenta borrar un motivo que ya está asociado a una cita o solicitud
- **THEN** el sistema rechaza el borrado e indica que debe desactivarse

#### Scenario: Desactivación de un motivo

- **WHEN** se desactiva un motivo
- **THEN** el sistema lo conserva para el histórico, lo excluye del selector y mantiene intactas las citas que lo referencian
