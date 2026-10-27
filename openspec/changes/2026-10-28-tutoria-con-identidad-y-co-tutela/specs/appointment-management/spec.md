# Spec Delta

## ADDED Requirements

### Requirement: Gestión de citas por tutor legal

El sistema SHALL permitir al tutor vinculado agendar, reprogramar y cancelar las citas de su paciente menor de edad, y SHALL registrar a nombre de quién se realizó la acción.

#### Scenario: Tutor agenda una cita del menor

- **WHEN** el tutor solicita una cita para el paciente que tutela
- **THEN** el sistema crea la cita a nombre del paciente y deja constancia de que la solicitó el tutor

#### Scenario: Tutor reprograma o cancela

- **WHEN** el tutor reprograma o cancela una cita del menor
- **THEN** el sistema aplica el cambio sobre la cita del paciente y notifica a paciente, tutor y psicólogo/a

#### Scenario: Tutor sin vínculo

- **WHEN** un usuario intenta operar sobre la cita de un paciente que no tutela ni es él mismo
- **THEN** el sistema rechaza la operación
