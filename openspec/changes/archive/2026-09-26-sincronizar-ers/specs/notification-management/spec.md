## Purpose
Envío y gestión de notificaciones automáticas: recordatorios previos a las citas, confirmación de asistencia y avisos ante cambios de horario o estado. Los canales principales son WhatsApp y correo electrónico.

## ADDED Requirements

### Requirement: Enviar recordatorios automáticos
El sistema SHALL enviar recordatorios automáticos antes de cada cita para reducir inasistencias.

#### Scenario: Recordatorio programado
- **WHEN** existe una cita programada dentro del tiempo de anticipación configurado (por defecto 24 h)
- **THEN** el sistema genera y envía un recordatorio al paciente y, si aplica, al psicólogo/a

### Requirement: Confirmación de asistencia
El sistema SHALL permitir al paciente confirmar o cancelar su asistencia desde la notificación.

#### Scenario: Confirmación desde notificación
- **WHEN** un paciente confirma su asistencia a través de la notificación
- **THEN** el sistema actualiza el estado de la cita a "Confirmada" y refleja el cambio en la agenda

#### Scenario: Cancelación desde notificación
- **WHEN** un paciente cancela su asistencia a través de la notificación
- **THEN** el sistema libera el horario de la cita y notifica al psicólogo/a

### Requirement: Notificación de cambios
El sistema SHALL informar al usuario afectado cuando una cita sufra modificaciones.

#### Scenario: Cambio de cita
- **WHEN** una cita programada es modificada o cancelada
- **THEN** el sistema envía una notificación inmediata con los detalles del cambio al paciente o psicólogo/a afectado
