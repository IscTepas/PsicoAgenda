## Purpose
Envío y gestión de notificaciones automáticas: recordatorios previos a las citas, confirmación de asistencia y avisos ante cambios de horario o estado. Los canales principales son WhatsApp y correo electrónico. La entrega por WhatsApp se realiza con la API de WhatsApp Business; un webhook solo puede recibir eventos o estados, no enviar mensajes.

## Requirements

### Requirement: Enviar recordatorios automáticos
El sistema SHALL enviar recordatorios automáticos antes de cada cita para reducir inasistencias.

#### Scenario: Recordatorio programado
- **WHEN** existe una cita programada dentro del tiempo de anticipación configurado (por defecto 24 h)
- **THEN** el sistema genera y envía un recordatorio al paciente y, si aplica, al psicólogo/a

### Requirement: Entrega por WhatsApp con la API de WhatsApp Business
El sistema SHALL enviar por la API de WhatsApp Business los avisos cuyo canal sea WhatsApp, usando el teléfono y las preferencias del usuario destinatario y una plantilla aprobada. El sistema SHALL NOT usar un webhook como mecanismo de envío; un webhook solo podrá recibir eventos o estados de entrega.

#### Scenario: Aviso generado para un usuario con WhatsApp habilitado
- **WHEN** el sistema genera una notificación para un usuario que tiene WhatsApp habilitado y un teléfono registrado
- **THEN** el sistema envía el aviso llamando a la API de WhatsApp Business con el teléfono de ese usuario y registra el resultado en la notificación

#### Scenario: Usuario sin teléfono o con WhatsApp deshabilitado
- **WHEN** el sistema genera una notificación para un usuario que no tiene teléfono o desactivó el canal de WhatsApp
- **THEN** el sistema no crea ni envía el aviso por WhatsApp y mantiene los demás canales sin cambios

#### Scenario: Fallo de la API
- **WHEN** la API de WhatsApp Business rechaza o no responde a un envío
- **THEN** el sistema conserva la notificación para reintentarla y la marca como fallida al agotar los intentos, sin duplicar el mensaje

#### Scenario: Recordatorio fuera de la ventana de conversación
- **WHEN** el aviso se envía fuera de la ventana de 24 horas de conversación
- **THEN** el sistema usa una plantilla aprobada por WhatsApp Business para entregarlo

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
