# Spec Delta

## ADDED Requirements

### Requirement: Tutoría de pacientes menores

El sistema SHALL representar al tutor legal como una persona que puede estar vinculada a una cuenta de usuario, y el vínculo con el paciente SHALL ser de muchos a muchos, con exactamente un tutor principal por paciente.

#### Scenario: Tutor con cuenta existente

- **WHEN** se vincula como tutor a una persona que ya tiene cuenta en el sistema
- **THEN** el sistema reutiliza esa cuenta y no crea una identidad duplicada

#### Scenario: Tutor sin cuenta

- **WHEN** se vincula como tutor a una persona sin cuenta
- **THEN** el sistema conserva sus datos de contacto y el vínculo queda sin usuario asociado

#### Scenario: Co-tutela

- **WHEN** un mismo paciente menor de edad tiene dos tutores
- **THEN** ambos quedan vinculados y solo uno es el principal, sin perder los permisos del otro

#### Scenario: Un tutor con varios menores

- **WHEN** una persona es tutora de dos pacientes
- **THEN** el sistema mantiene dos vínculos independientes sobre la misma persona

### Requirement: Límites de la tutoría

El sistema SHALL NOT cambiar el rol de la cuenta por ser tutor, SHALL NOT otorgar acceso a la bitácora ni a las notas clínicas, y SHALL impedir la tutoría de uno mismo y la del psicólogo tratante sobre su propio paciente.

#### Scenario: Tutor que también es paciente

- **WHEN** una persona con expediente propio es tutora de un menor
- **THEN** el sistema mantiene su expediente y el del menor separados y le permite gestionar solo la agenda del menor

#### Scenario: Tutoría de sí mismo

- **WHEN** se intenta vincular como tutor a la misma persona del paciente
- **THEN** el sistema rechaza la operación

#### Scenario: Psicólogo tratante como tutor

- **WHEN** se intenta vincular como tutor al psicólogo que atiende al paciente
- **THEN** el sistema rechaza la operación

#### Scenario: Acceso al expediente del menor

- **WHEN** un tutor intenta abrir la bitácora o las notas clínicas del menor
- **THEN** el sistema lo rechaza y no expone ningún contenido clínico
