# Historial Clínico

## Purpose

Gestión del historial clínico psicológico individual del paciente: bitácora por sesión, notas clínicas, edición con registro de modificaciones, consentimiento informado, antecedentes y contacto de emergencia, bajo criterios éticos (APA) y con respaldo a tutores legales para menores.

## Requirements

### Requirement: Apertura de historial clínico
El sistema SHALL abrir un historial clínico para cada paciente, registrando fecha de apertura, antecedentes y observaciones generales.

#### Scenario: Apertura del historial
- **WHEN** un paciente inicia su proceso terapéutico
- **THEN** el sistema SHALL crear su historial clínico con fecha de apertura
- **AND** SHALL registrar antecedentes y el diagnóstico inicial si existe

### Requirement: Bitácora por sesión
El sistema SHALL generar una entrada de bitácora por cada sesión atendida, asociada a la cita correspondiente.

#### Scenario: Registrar nota de sesión
- **WHEN** el psicólogo captura la nota de una sesión
- **THEN** el sistema SHALL guardar la entrada de bitácora vinculada a la cita del paciente

### Requirement: Edición con registro de modificaciones
El sistema SHALL permitir editar las entradas del historial manteniendo un registro de las modificaciones realizadas.

#### Scenario: Editar una entrada existente
- **WHEN** el psicólogo edita una entrada del historial
- **THEN** el sistema SHALL conservar la versión anterior y registrar el cambio con su autor y fecha

### Requirement: Visualización del historial completo
El sistema SHALL permitir al psicólogo visualizar el historial completo del paciente, incluyendo antecedentes y todas las entradas de sesión.

#### Scenario: Consulta del historial
- **WHEN** el psicólogo consulta el historial de un paciente
- **THEN** el sistema SHALL mostrar las entradas de bitácora, antecedentes, observaciones generales y el historial de modificaciones

### Requirement: Consentimiento informado y código de conducta APA
El sistema SHALL exigir el registro del consentimiento informado y apegar la gestión clínica al código de conducta de la APA.

#### Scenario: Registro del consentimiento
- **WHEN** se abre un proceso terapéutico
- **THEN** el sistema SHALL requerir el registro del consentimiento informado del paciente (o de su tutor legal si es menor)
- **AND** SHALL asociar el consentimiento al historial correspondiente

### Requirement: Contacto de emergencia obligatorio
El sistema SHALL requerir un campo de contacto de emergencia en el expediente del paciente.

#### Scenario: Expediente sin contacto de emergencia
- **WHEN** se intenta completar un historial sin contacto de emergencia registrado
- **THEN** el sistema SHALL impedir la finalización hasta que se indique el contacto de emergencia

### Requirement: Acceso de tutor legal para menores
El sistema SHALL restringir el acceso a la información clínica de menores al paciente autorizado y a su tutor legal.

#### Scenario: Consulta de historial de un menor
- **WHEN** un tutor legal autorizado consulta la información de un paciente menor
- **THEN** el sistema SHALL permitir únicamente el acceso a la información que el tutor tiene autorizada
