# Protección de Datos

## Purpose

Garantías de seguridad, privacidad y cumplimiento normativo de la información clínica y personal: cifrado, control de sesiones, cumplimiento de la LFPDPPP (México), retención de datos y portabilidad a solicitud del paciente.

## Requirements

### Requirement: Cifrado de datos
El sistema SHALL cifrar los datos en tránsito y en almacenamiento, y SHALL cifrar las contraseñas de los usuarios.

#### Scenario: Transmisión y almacenamiento seguro
- **WHEN** los datos viajan por la red o se guardan en almacenamiento persistente
- **THEN** el sistema SHALL cifrarlos tanto en tránsito como en reposo

#### Scenario: Almacenamiento de contraseñas
- **WHEN** se registra o actualiza la contraseña de un usuario
- **THEN** el sistema SHALL almacenarla cifrada y nunca en texto plano

### Requirement: Autenticación en dos pasos (2FA)
El sistema SHALL ofrecer autenticación en dos pasos (2FA) para el acceso a las cuentas.

#### Scenario: Inicio de sesión con 2FA habilitado
- **WHEN** un usuario autenticado con 2FA habilitado inicia sesión con credenciales válidas
- **THEN** el sistema SHALL requerir un segundo factor antes de conceder el acceso

### Requirement: Control estricto de sesiones
El sistema SHALL aplicar controles de sesión con tiempo límite e intentos fallidos.

#### Scenario: Reintentos fallidos excesivos
- **WHEN** se exceden los intentos fallidos de autenticación
- **THEN** el sistema SHALL bloquear temporalmente el acceso

#### Scenario: Sesión vencida
- **WHEN** la sesión supera el tiempo límite de inactividad
- **THEN** el sistema SHALL cerrar la sesión y requerir autenticación nuevamente

### Requirement: Cumplimiento de privacidad (LFPDPPP)
El sistema SHALL cumplir con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México) para el tratamiento de datos personales y clínicos.

#### Scenario: Tratamiento de datos personales
- **WHEN** el sistema trata datos personales o sensibles de pacientes
- **THEN** SHALL hacerlo conforme a la LFPDPPP, con base en el consentimiento registrado

### Requirement: Respaldo en AWS
El sistema SHALL respaldar la información en servidores de AWS.

#### Scenario: Respaldo de información
- **WHEN** se almacena información del sistema
- **THEN** SHALL estar respaldada en servidores de AWS

### Requirement: Alta disponibilidad
El sistema SHALL mantener una alta disponibilidad del 99% durante el horario laboral.

#### Scenario: Disponibilidad en horario laboral
- **WHEN** se opera durante el horario laboral
- **THEN** el sistema SHALL permanecer disponible al menos el 99% del tiempo

### Requirement: Retención de datos
El sistema SHALL conservar los expedientes conforme a la normativa legal, incluso cuando el paciente esté inactivo.

#### Scenario: Paciente inactivo
- **WHEN** un paciente pasa a estado inactivo
- **THEN** el sistema SHALL conservar su expediente durante el período legal de retención

### Requirement: Portabilidad de datos
El sistema SHALL permitir la exportación de los datos del paciente a solicitud de este.

#### Scenario: Solicitud de portabilidad
- **WHEN** un paciente solicita la exportación de su información
- **THEN** el sistema SHALL generar y entregar una copia portátil de sus datos
