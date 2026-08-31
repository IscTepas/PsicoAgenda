# Gestión de Citas

## Purpose

Programación y control de la agenda digital: crear, modificar y cancelar citas, verificar disponibilidad para evitar empalmes y registrar la asistencia del paciente.

## Requirements

### Requirement: Programación de citas
El sistema SHALL permitir programar citas con su fecha, hora, duración, motivo y modalidad, respetando la duración estándar de 45 a 60 minutos.

#### Scenario: Crear una cita válida
- **WHEN** el paciente o el psicólogo programa una cita con fecha, hora y motivo
- **THEN** el sistema SHALL registrar la cita en estado Pendiente con su modalidad y duración dentro del rango estándar

#### Scenario: Duración fuera del rango
- **WHEN** se intenta programar una cita cuya duración está fuera de 45-60 minutos
- **THEN** el sistema SHALL rechazar el registro o requerir justificación del psicólogo

### Requirement: Verificación de disponibilidad sin empalmes
El sistema SHALL evitar la sobreposición de citas de un mismo psicólogo y/o recurso.

#### Scenario: Conflicto de horario
- **WHEN** una cita nueva se solapa con otra ya programada para el mismo psicólogo
- **THEN** el sistema SHALL advertir del conflicto y bloquear el empalme

### Requirement: Modificación de citas
El sistema SHALL permitir modificar citas existentes (fecha, hora, duración, motivo) respetando la disponibilidad.

#### Scenario: Reprogramar una cita
- **WHEN** se modifica la fecha u hora de una cita
- **THEN** el sistema SHALL validar de nuevo la disponibilidad
- **AND** SHALL notificar el cambio de horario al paciente

### Requirement: Cancelación de citas
El sistema SHALL permitir cancelar citas, pasándolas a estado Cancelada.

#### Scenario: Cancelar una cita programada
- **WHEN** el paciente o el psicólogo cancela una cita
- **THEN** el sistema SHALL marcar la cita como Cancelada
- **AND** SHALL notificar a las partes involucradas

### Requirement: Registro de asistencia
El sistema SHALL registrar la asistencia real del paciente, pasando la cita a estado Atendida cuando corresponda.

#### Scenario: Marcar asistencia
- **WHEN** el psicólogo registra la asistencia del paciente tras la sesión
- **THEN** el sistema SHALL actualizar el estado de la cita a Atendida
