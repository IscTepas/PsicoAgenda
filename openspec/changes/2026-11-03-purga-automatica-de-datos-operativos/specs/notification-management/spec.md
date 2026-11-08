# Spec Delta

## ADDED Requirements

### Requirement: Recordatorios reemplazados se eliminan

El sistema SHALL eliminar los recordatorios pendientes de una cita cuando esta se reprograma, cancela o registra asistencia, en lugar de conservarlos como avisos cancelados.

#### Scenario: Reprogramación de una cita

- **WHEN** una cita con recordatorios pendientes cambia de fecha u hora
- **THEN** el sistema elimina los recordatorios pendientes anteriores y programa los nuevos para la fecha actualizada

#### Scenario: Cancelación de una cita

- **WHEN** una cita con recordatorios pendientes se cancela
- **THEN** el sistema elimina los recordatorios pendientes y no deja avisos cancelados acumulados

#### Scenario: Aviso ya enviado

- **WHEN** el recordatorio ya fue entregado
- **THEN** el sistema lo conserva y no lo elimina al reprogramar o cancelar la cita
