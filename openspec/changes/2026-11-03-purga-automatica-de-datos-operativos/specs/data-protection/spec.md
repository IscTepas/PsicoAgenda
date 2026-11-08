# Spec Delta

## ADDED Requirements

### Requirement: Retención de datos operativos

El sistema SHALL purgar automáticamente los datos operativos cuyo periodo de retención haya vencido, y SHALL NOT eliminar automáticamente expedientes clínicos, citas, pagos, consentimientos informados, entradas de bitácora, tutores ni cuentas de usuario.

#### Scenario: Notificación enviada o fallida vencida

- **WHEN** una notificación en estado `ENVIADA` o `FALLIDA` supera los 90 días desde su creación
- **THEN** el sistema la elimina en la siguiente purga

#### Scenario: Recordatorio cancelado vencido

- **WHEN** una notificación en estado `CANCELADA` supera los 7 días desde su creación
- **THEN** el sistema la elimina en la siguiente purga

#### Scenario: Notificación pendiente

- **WHEN** una notificación está en estado `PENDIENTE`, sin importar su antigüedad
- **THEN** el sistema la conserva y la purga no la modifica

#### Scenario: Entrada de cache vencida

- **WHEN** una entrada de `cache_registro` alcanza su vencimiento
- **THEN** el sistema la elimina en la siguiente purga

#### Scenario: Solicitud pendiente con fecha vencida

- **WHEN** una solicitud de cita lleva más de 30 días en estado `PENDIENTE` y su fecha solicitada ya pasó
- **THEN** el sistema la marca `CANCELADA` para que deje de ocupar la cola de atención

#### Scenario: Solicitud terminal antigua

- **WHEN** una solicitud en estado `RECHAZADA` o `CANCELADA`, sin cita asociada, supera los 12 meses
- **THEN** el sistema la elimina

#### Scenario: Dato clínico o de negocio

- **WHEN** la purga se ejecuta
- **THEN** no elimina ni modifica expedientes clínicos, citas, pagos, consentimientos, entradas de bitácora, tutores ni usuarios, aunque tengan años de antigüedad

### Requirement: Purga segura y observable

El sistema SHALL ejecutar la purga en lotes acotados, SHALL ser idempotente ante ejecuciones solapadas y SHALL informar las filas eliminadas por tabla y el tamaño de la base. El disparador SHALL exigir una credencial secreta y SHALL fallar cerrado cuando esta no esté configurada.

#### Scenario: Trabajo pendiente tras el lote

- **WHEN** quedan más filas vencidas que el máximo de un lote
- **THEN** el sistema elimina hasta el máximo, responde correctamente y deja el resto para la siguiente ejecución

#### Scenario: Ejecuciones solapadas

- **WHEN** dos purgas se ejecutan al mismo tiempo
- **THEN** ninguna falla, no se bloquean entre sí y no se elimina dos veces el mismo dato

#### Scenario: Sin credencial

- **WHEN** llega una petición al disparador sin la cabecera de autorización
- **THEN** el sistema responde 401 y no purga nada

#### Scenario: Secreto no configurado

- **WHEN** el entorno no definió el secreto del disparador
- **THEN** el sistema responde 503 y no purga nada

#### Scenario: Resultado informado

- **WHEN** la purga termina
- **THEN** el sistema informa cuántas filas eliminó por tabla y el tamaño actual de la base

### Requirement: Control de crecimiento de las tablas de alta rotación

El sistema SHALL mantener índices que acoten el costo de la purga y SHALL configurar la recuperación de espacio de las tablas de alta rotación, incluido un mantenimiento periódico de estadísticas y espacio reutilizable.

#### Scenario: Purga sin recorrido completo

- **WHEN** se purgan notificaciones o solicitudes por fecha
- **THEN** la consulta usa un índice y no recorre la tabla completa

#### Scenario: Tabla de alta rotación

- **WHEN** las tuplas muertas de `notificaciones` o `cache_registro` superan el umbral configurado
- **THEN** el autovacuum se activa con los parámetros específicos de la tabla, sin esperar el umbral global

#### Scenario: Mantenimiento periódico

- **WHEN** se ejecuta el mantenimiento mensual de la base
- **THEN** el sistema actualiza estadísticas y recupera espacio reutilizable de las tablas operativas
