# Spec Delta

## MODIFIED Requirements

### Requirement: Registro de usuarios
El sistema SHALL permitir que nuevos pacientes y psicólogos/as creen una cuenta proporcionando datos básicos, validando la información y verificando el correo electrónico mediante un código de un solo uso generado por la aplicación. La cuenta y su perfil SHALL crearse únicamente después de que el código sea verificado, y los datos del formulario SHALL no persistirse antes de ese momento.

#### Scenario: Registro exitoso de paciente
- **WHEN** un usuario proporciona nombre, correo electrónico, contraseña y tipo de usuario, solicita el código de verificación y entrega un código válido y vigente
- **THEN** el sistema valida los datos, verifica que el correo no exista, crea la cuenta ya confirmada con su perfil y confirma el alta

#### Scenario: Registro de paciente menor de edad
- **WHEN** se registra un paciente menor de edad
- **THEN** el sistema solicita y vincula los datos del tutor legal y registra el consentimiento informado correspondiente

#### Scenario: Código inválido o vencido
- **WHEN** el usuario entrega un código incorrecto, vencido o no ha solicitado uno
- **THEN** el sistema rechaza la verificación, no crea la cuenta y no persiste ningún dato del formulario

## ADDED Requirements

### Requirement: Verificación de correo por código temporal
El sistema SHALL enviar al correo del solicitante un código de 6 dígitos al pre-registrarse, conservando únicamente su huella criptográfica en un almacenamiento temporal con expiración de 10 minutos. El sistema SHALL NOT almacenar los datos del formulario en la base de datos antes de la verificación, y la expiración SHALL ocurrir sin procesos de limpieza programados.

#### Scenario: Solicitud de código
- **WHEN** un usuario solicita el registro proporcionando un correo válido
- **THEN** el sistema genera un código de 6 dígitos, lo envía al correo y conserva solo su huella con una expiración a 10 minutos

#### Scenario: Expiración automática
- **WHEN** transcurren 10 minutos sin que el código sea verificado
- **THEN** el sistema lo considera inválido y desaparece del almacenamiento temporal por sí mismo, sin dejar residuos en la base de datos

#### Scenario: Reintento tras expiración
- **WHEN** el usuario entrega un código cuya expiración ya ocurrió
- **THEN** el sistema lo rechaza y le solicita generar uno nuevo

### Requirement: Control de abuso del código de verificación
El sistema SHALL limitar los intentos de verificación por código, SHALL imponer un periodo de espera antes de reenviar el mismo código y SHALL limitar la generación de códigos por origen.

#### Scenario: Agotamiento de intentos
- **WHEN** se presentan más intentos fallidos de los permitidos para un mismo código
- **THEN** el sistema invalida el código y exige solicitar uno nuevo

#### Scenario: Reenvío prematuro
- **WHEN** el usuario solicita reenviar el código antes de que termine el periodo de espera
- **THEN** el sistema no envía un correo adicional e informa el tiempo restante

#### Scenario: Generación masiva desde un origen
- **WHEN** un mismo origen supera el límite de solicitudes de código en un periodo corto
- **THEN** el sistema rechaza las peticiones adicionales sin enviar correos
