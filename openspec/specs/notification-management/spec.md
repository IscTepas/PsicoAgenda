# Gestión de Notificaciones

## Purpose

Envío automático de recordatorios y notificaciones a los pacientes: recordatorio 24 horas antes de la cita vía WhatsApp, confirmación de asistencia y avisos ante cambios de horario. Los canales de envío son WhatsApp y correo electrónico.

## Requirements

### Requirement: Recordatorio automático de citas
El sistema SHALL enviar un recordatorio automático al paciente 24 horas antes de la cita, a través de los canales configurados (WhatsApp y/o correo electrónico).

#### Scenario: Recordatorio previo a la cita
- **WHEN** faltan 24 horas para una cita confirmada
- **THEN** el sistema SHALL enviar un recordatorio al paciente con los datos de la cita
- **AND** SHALL usar el canal configurado (WhatsApp, correo electrónico o ambos)

### Requirement: Confirmación de asistencia
El sistema SHALL permitir que el paciente confirme su asistencia a la cita a través de la notificación.

#### Scenario: Paciente confirma asistencia
- **WHEN** el paciente confirma su asistencia respondiendo a la notificación
- **THEN** el sistema SHALL registrar la confirmación y actualizar el estado de la cita

### Requirement: Notificación ante cambios de horario
El sistema SHALL notificar a las partes involucradas cuando una cita cambia de horario, de forma o se cancela.

#### Scenario: Cambio de horario
- **WHEN** una cita programada o confirmada cambia de fecha u hora
- **THEN** el sistema SHALL notificar el cambio al paciente

#### Scenario: Cancelación de cita
- **WHEN** una cita se cancela
- **THEN** el sistema SHALL notificar la cancelación a las partes involucradas
