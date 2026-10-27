# Spec Delta

## ADDED Requirements

### Requirement: Despacho programado independiente del tráfico

El sistema SHALL despachar los avisos cuya hora programada ya pasó dentro de los 5 minutos siguientes, sin depender de que un usuario realice una petición.

#### Scenario: Recordatorio vencido sin tráfico

- **WHEN** un recordatorio alcanza su hora programada y no hay usuarios usando la aplicación
- **THEN** el sistema lo entrega en un plazo máximo de 5 minutos

#### Scenario: Despacho solapado

- **WHEN** dos barridos se ejecutan al mismo tiempo
- **THEN** cada aviso se entrega una sola vez y el segundo barrido no lo duplica

### Requirement: Autenticación del disparador interno

El sistema SHALL exigir una credencial secreta en el disparador del barrido y SHALL rechazar la ejecución cuando la credencial falte o no coincida. Cuando el secreto no esté configurado, SHALL fallar cerrado.

#### Scenario: Sin credencial

- **WHEN** llega una petición al disparador sin la cabecera de autorización
- **THEN** el sistema responde 401 y no procesa ningún aviso

#### Scenario: Credencial incorrecta

- **WHEN** llega una petición con una credencial que no coincide
- **THEN** el sistema responde 401 y no procesa ningún aviso

#### Scenario: Secreto no configurado

- **WHEN** el entorno no definió el secreto del disparador
- **THEN** el sistema responde 503 y deja los avisos en cola, en lugar de aceptar la petición
