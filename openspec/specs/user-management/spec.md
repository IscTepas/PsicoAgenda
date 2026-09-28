## Purpose
Gestión de usuarios del sistema: registro de pacientes y psicólogos/as, autenticación, perfiles, recuperación de contraseñas y control de roles y permisos. Incluye el manejo de tutores legales para pacientes menores de edad.

## Requirements

### Requirement: Registro de usuarios
El sistema SHALL permitir que nuevos pacientes y psicólogos/as creen una cuenta proporcionando datos básicos, validando la información y verificando el correo electrónico.

#### Scenario: Registro exitoso de paciente
- **WHEN** un usuario proporciona nombre, correo electrónico, contraseña y tipo de usuario
- **THEN** el sistema valida los datos, verifica que el correo no exista, cifra la contraseña y crea la cuenta con un mensaje de confirmación

#### Scenario: Registro de paciente menor de edad
- **WHEN** se registra un paciente menor de edad
- **THEN** el sistema solicita y vincula los datos del tutor legal y registra el consentimiento informado correspondiente

### Requirement: Autenticación
El sistema SHALL verificar la identidad del usuario al iniciar sesión y otorgar acceso según su rol.

#### Scenario: Inicio de sesión válido
- **WHEN** un usuario ingresa correo y contraseña correctos
- **THEN** el sistema genera una sesión segura y redirige a la interfaz correspondiente a su rol

#### Scenario: Inicio de sesión inválido
- **WHEN** un usuario ingresa credenciales incorrectas
- **THEN** el sistema muestra un mensaje de error y registra el intento fallido

### Requirement: Gestión de perfil de usuario
El sistema SHALL permitir a los usuarios consultar y actualizar su información personal y preferencias.

#### Scenario: Actualización de perfil
- **WHEN** un usuario modifica campos permitidos de su perfil
- **THEN** el sistema valida el formato, guarda los cambios y confirma la actualización

### Requirement: Recuperación de contraseña
El sistema SHALL permitir restablecer la contraseña mediante un enlace o clave temporal segura con tiempo límite.

#### Scenario: Solicitud de recuperación
- **WHEN** un usuario solicita recuperar su contraseña con su correo registrado
- **THEN** el sistema genera un enlace o clave temporal segura, la envía al correo y permite el restablecimiento dentro del tiempo límite

### Requirement: Control de roles y permisos
El sistema SHALL restringir las funciones disponibles según el rol del usuario: paciente, psicólogo/a o sistema.

#### Scenario: Acceso por rol
- **WHEN** un usuario autenticado accede al sistema
- **THEN** el sistema identifica su rol, muestra solo las opciones permitidas y bloquea funciones no autorizadas
