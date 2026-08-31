# Gestión de Usuarios

## Purpose

Gestión de usuarios del sistema (psicólogos/as y pacientes): registro, autenticación, recuperación de contraseña, roles y edición de perfiles, con énfasis en el manejo de menores de edad (tutores legales).

## Requirements

### Requirement: Registro de pacientes y psicólogos
El sistema SHALL permitir el registro de pacientes y psicólogos, capturando los datos identificativos y de perfil propios de cada rol (incluido el teléfono).

#### Scenario: Registro de un paciente
- **WHEN** un nuevo paciente se registra proporcionando correo, teléfono y datos personales
- **THEN** el sistema SHALL crear la cuenta con rol paciente y estado activo
- **AND** SHALL requerir la captura de fecha de nacimiento, género, dirección y contacto de emergencia

#### Scenario: Registro de un psicólogo
- **WHEN** un nuevo psicólogo se registra proporcionando correo, teléfono y credencial de cédula profesional
- **THEN** el sistema SHALL crear la cuenta con rol psicólogo
- **AND** SHALL requerir cédula profesional, especialidad y bio

### Requirement: Autenticación cifrada
El sistema SHALL autenticar a los usuarios mediante credenciales cifradas y gestionar el control de sesión de forma segura.

#### Scenario: Inicio de sesión correcto
- **WHEN** un usuario proporciona correo y contraseña válidos
- **THEN** el sistema SHALL abrir una sesión autenticada con su rol asignado

#### Scenario: Sesión con duración y reintentos limitados
- **WHEN** la sesión supera el tiempo límite o se exceden los intentos fallidos de contraseña
- **THEN** el sistema SHALL cerrar o bloquear el acceso según los controles de sesión definidos

### Requirement: Recuperación de contraseña
El sistema SHALL permitir a los usuarios recuperar su contraseña de forma segura.

#### Scenario: Solicitud de recuperación
- **WHEN** un usuario solicita la recuperación de su contraseña con un correo registrado
- **THEN** el sistema SHALL emitir un mecanismo seguro de restablecimiento (temporal, de un solo uso)

### Requirement: Edición de perfiles
El sistema SHALL permitir que un usuario autenticado edite los datos de su propio perfil.

#### Scenario: Edición del propio perfil
- **WHEN** un usuario autenticado edita su perfil
- **THEN** el sistema SHALL guardar los cambios y actualizar la información visible del usuario

### Requirement: Asociación de tutor legal para menores
El sistema SHALL permitir asociar a un paciente menor de edad con una cuenta de tutor legal y su consentimiento informado.

#### Scenario: Registro de paciente menor
- **WHEN** un paciente es menor de edad
- **THEN** el sistema SHALL requerir la asociación de una cuenta de tutor legal y el registro de su consentimiento informado
- **AND** SHALL vincular la gestión de la cuenta del menor al tutor autorizado
