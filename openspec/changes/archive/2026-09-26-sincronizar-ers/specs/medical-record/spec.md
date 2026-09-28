## Purpose
Gestión del historial clínico psicológico: apertura de expediente, bitácora por sesión, edición con trazabilidad de cambios, consulta del historial completo, consentimiento informado y manejo de contactos de emergencia y tutores legales.

## ADDED Requirements

### Requirement: Registro de paciente y apertura de expediente
El sistema SHALL permitir registrar un nuevo paciente y crear su expediente clínico inicial.

#### Scenario: Registro clínico exitoso
- **WHEN** el psicólogo/a ingresa los datos obligatorios de un nuevo paciente
- **THEN** el sistema valida la información, verifica duplicados, cifra datos sensibles y crea el expediente clínico inicial

### Requirement: Ver historial clínico
El sistema SHALL mostrar el historial clínico completo del paciente de forma organizada y navegable.

#### Scenario: Consulta de historial
- **WHEN** el psicólogo/a consulta el historial de un paciente autorizado
- **THEN** el sistema muestra datos generales, antecedentes, diagnósticos, sesiones y documentos asociados

### Requirement: Agregar entrada de bitácora
El sistema SHALL generar un formulario semi-completado a partir de los datos de una cita para registrar observaciones de sesión.

#### Scenario: Pre-llenado de bitácora
- **WHEN** el psicólogo/a inicia una nueva entrada de bitácora desde una cita atendida
- **THEN** el sistema pre-llena el formulario con datos de la cita y deja los campos clínicos para completar manualmente

### Requirement: Guardar entrada de bitácora
El sistema SHALL almacenar los datos clínicos capturados en el formulario de bitácora.

#### Scenario: Guardado exitoso
- **WHEN** el psicólogo/a guarda una entrada de bitácora completada
- **THEN** el sistema valida campos obligatorios, registra fecha, hora y profesional responsable, y confirma el guardado

### Requirement: Editar bitácora con trazabilidad
El sistema SHALL permitir modificar una entrada de la bitácora manteniendo el historial de versiones.

#### Scenario: Edición con control de cambios
- **WHEN** el psicólogo/a edita una entrada existente de la bitácora
- **THEN** el sistema guarda una nueva versión, registra quién realizó el cambio y cuándo, y confirma la actualización

### Requirement: Consentimiento informado
El sistema SHALL registrar el consentimiento informado otorgado por el paciente o su tutor legal.

#### Scenario: Registro de consentimiento
- **WHEN** se registra o actualiza el consentimiento informado de un paciente
- **THEN** el sistema almacena el documento, la fecha de firma y, si aplica, la información del tutor legal

### Requirement: Contacto de emergencia y tutor legal
El sistema SHALL exigir un contacto de emergencia y, para menores de edad, vincular a un tutor legal.

#### Scenario: Expediente con contacto de emergencia
- **WHEN** se crea o actualiza el expediente de un paciente
- **THEN** el sistema valida que exista al menos un contacto de emergencia y, si el paciente es menor de edad, un tutor legal responsable
