# Spec Delta

## ADDED Requirements

### Requirement: Visibilidad del detalle de cita por rol

El sistema SHALL NO mostrar al usuario con rol PACIENTE las tarjetas con información personal del paciente ni las acciones de acceso al expediente clínico en el diálogo de detalle de cita. El sistema SHALL seguir mostrándolas al usuario con rol PSICOLOGO.

#### Scenario: Detalle de cita para paciente oculta información del paciente

- **WHEN** un usuario con rol de paciente abre el diálogo de detalle de una cita
- **THEN** el sistema no muestra tarjetas con información personal del paciente ni el botón "Ver Expediente"

#### Scenario: Detalle de cita para psicólogo muestra información del paciente

- **WHEN** un usuario con rol de psicólogo/a abre el diálogo de detalle de una cita
- **THEN** el sistema muestra la tarjeta con información del paciente y el botón "Ver Expediente"
