# Spec Delta

## ADDED Requirements

### Requirement: Avisos al tutor legal

El sistema SHALL enviar al tutor vinculado los mismos avisos de agenda que recibe el paciente menor de edad, respetando sus propias preferencias de canal.

#### Scenario: Recordatorio de la cita del menor

- **WHEN** se genera un recordatorio para una cita de un paciente menor de edad con tutor vinculado
- **THEN** el sistema envía el aviso al paciente y a su tutor según las preferencias de cada uno

#### Scenario: Tutor sin preferencia activa

- **WHEN** el tutor no tiene ningún canal de aviso habilitado
- **THEN** el sistema no le envía mensajes y mantiene el aviso al paciente sin cambios
