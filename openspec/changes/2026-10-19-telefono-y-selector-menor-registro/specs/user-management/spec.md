# Spec Delta

## ADDED Requirements

### Requirement: Teléfono y declaración de minoría en el registro

El sistema SHALL validar los teléfonos del registro (personal, contacto de emergencia y tutor legal) como números locales de exactamente 10 dígitos, presentándolos con el formato `555-123-4567`. El sistema SHALL ofrecer la declaración de si la cuenta es para un menor de edad y SHALL mantenerla coherente con la fecha de nacimiento, que es la fuente de verdad para exigir los datos del tutor legal.

#### Scenario: Teléfono con formato local

- **WHEN** una persona escribe o pega un teléfono en el formulario de registro
- **THEN** el sistema conserva solo los dígitos, los agrupa como `555-123-4567` y no admite más de 10 dígitos

#### Scenario: Teléfono incompleto

- **WHEN** el teléfono tiene menos de 10 dígitos
- **THEN** el sistema no permite enviar el registro e indica que faltan dígitos

#### Scenario: Declaración de minoría coherente con la fecha

- **WHEN** la persona declara que registra a un menor y la fecha de nacimiento corresponde a un mayor de edad (o al contrario)
- **THEN** el sistema muestra el error en la fecha y no deja continuar hasta que ambas coincidan

#### Scenario: Registro de un menor

- **WHEN** la fecha de nacimiento corresponde a un menor de 18 años
- **THEN** el sistema muestra la sección del tutor legal antes de los datos de acceso y exige sus datos y consentimiento, sin importar lo que se haya declarado en el selector

#### Scenario: Teléfono de contacto de un menor

- **WHEN** la cuenta es para un menor de edad
- **THEN** el sistema usa el teléfono del tutor legal como teléfono de contacto del alta y deja deshabilitado el teléfono personal
