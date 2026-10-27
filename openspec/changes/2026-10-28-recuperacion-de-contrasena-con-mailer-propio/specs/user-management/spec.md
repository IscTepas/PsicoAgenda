# Spec Delta

## MODIFIED Requirements

### Requirement: Recuperación de contraseña
El sistema SHALL permitir restablecer la contraseña mediante un token de un solo uso emitido por la propia aplicación, con tiempo límite y almacenado únicamente como huella criptográfica. La solicitud SHALL responder de forma uniforme exista o no la cuenta, y SHALL limitar las solicitudes por correo y por origen.

#### Scenario: Solicitud de recuperación
- **WHEN** un usuario solicita recuperar su contraseña con su correo registrado
- **THEN** el sistema genera un token de un solo uso, lo envía al correo con el mailer de la aplicación y permite el restablecimiento dentro del tiempo límite

#### Scenario: Solicitud con correo no registrado
- **WHEN** se solicita recuperación para un correo que no tiene cuenta
- **THEN** el sistema responde igual que en el caso exitoso y no envía ningún correo

#### Scenario: Token reutilizado o vencido
- **WHEN** se presenta un token ya usado o fuera del tiempo límite
- **THEN** el sistema rechaza el restablecimiento y exige solicitar uno nuevo

#### Scenario: Restablecimiento exitoso
- **WHEN** el usuario presenta un token vigente y una contraseña válida
- **THEN** el sistema actualiza la contraseña, inutiliza el token y permite iniciar sesión con la nueva

#### Scenario: Exceso de solicitudes
- **WHEN** un mismo correo u origen supera el límite de solicitudes en la ventana definida
- **THEN** el sistema deja de enviar correos y responde con el tiempo restante
