# Spec Delta

## ADDED Requirements

### Requirement: Disponibilidad observable

El sistema SHALL exponer un estado de salud verificable desde fuera del hosting que distinga entre la caída de la API y la de la base de datos.

#### Scenario: Base de datos no alcanzable

- **WHEN** el chequeo de salud no puede alcanzar la base de datos
- **THEN** el endpoint responde 503 e identifica la base de datos como no disponible

#### Scenario: Servicio sano

- **WHEN** el chequeo alcanza la base de datos
- **THEN** el endpoint responde 200 e identifica la base de datos como disponible

### Requirement: Alertas ante fallos sostenidos

El sistema SHALL notificar al equipo responsable cuando los chequeos fallen de forma consecutiva durante el umbral definido, y SHALL NOT alertar por un fallo aislado.

#### Scenario: Fallo aislado

- **WHEN** un chequeo falla y el siguiente responde correctamente
- **THEN** el sistema no genera ninguna alerta

#### Scenario: Caída sostenida

- **WHEN** los chequeos fallan de forma consecutiva durante el umbral definido
- **THEN** el sistema notifica al equipo indicando qué componente falló

#### Scenario: Recuperación

- **WHEN** el servicio vuelve a responder correctamente después de una alerta
- **THEN** el sistema lo informa y deja de insistir con la misma alerta
