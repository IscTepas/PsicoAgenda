## Purpose
Protección de datos personales y clínicos: cifrado, control de sesiones, autenticación segura, cumplimiento de la LFPDPPP, respaldo en AWS, retención de expedientes, portabilidad de datos y auditoría de accesos.

## Requirements

### Requirement: Cifrado de datos
El sistema SHALL cifrar los datos en tránsito y en almacenamiento, especialmente contraseñas e información clínica.

#### Scenario: Almacenamiento seguro
- **WHEN** se guarda información sensible en la base de datos
- **THEN** el sistema almacena la información cifrada aplicando algoritmos seguros

### Requirement: Control de sesiones
El sistema SHALL crear sesiones únicas y cifradas, controlar la inactividad y finalizar sesiones por expiración.

#### Scenario: Expiración por inactividad
- **WHEN** un usuario permanece inactivo más allá del tiempo permitido
- **THEN** el sistema cierra la sesión automáticamente y requiere autenticación nuevamente

### Requirement: Cumplimiento LFPDPPP
El sistema SHALL alinear el manejo de datos personales y clínicos con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México).

#### Scenario: Tratamiento de datos personales
- **WHEN** el sistema recolecta, almacena o comparte datos personales
- **THEN** lo hace con base en el consentimiento informado, la finalidad declarada y las medidas de seguridad requeridas por la ley

### Requirement: Respaldo en AWS
El sistema SHALL realizar respaldos periódicos y cifrados de la información en servidores de AWS.

#### Scenario: Respaldo programado
- **WHEN** se ejecuta el trabajo de respaldo programado
- **THEN** el sistema genera una copia de seguridad cifrada y la almacena en la infraestructura cloud configurada

### Requirement: Retención de expedientes
El sistema SHALL conservar los expedientes clínicos por el tiempo mínimo exigido por la normativa, incluso si el paciente está inactivo.

#### Scenario: Intento de eliminación antes de plazo
- **WHEN** se intenta eliminar un expediente antes del plazo legal de retención
- **THEN** el sistema bloquea la eliminación y registra el intento

### Requirement: Portabilidad de datos
El sistema SHALL facilitar la exportación del historial de citas y notas del paciente si este lo solicita.

#### Scenario: Solicitud de portabilidad
- **WHEN** un paciente solicita la portabilidad de sus datos
- **THEN** el sistema genera un archivo exportable en formato estándar y lo entrega de forma segura

### Requirement: Confidencialidad profesional
El sistema SHALL asegurar que la información clínica solo sea accesible para usuarios autorizados.

#### Scenario: Acceso restringido a historial
- **WHEN** un usuario intenta acceder a un historial clínico
- **THEN** el sistema verifica sus permisos y permite el acceso solo si está autorizado

### Requirement: Auditoría y trazabilidad
El sistema SHALL registrar acciones relevantes sobre datos sensibles para fines de auditoría.

#### Scenario: Registro de modificación clínica
- **WHEN** un profesional modifica una entrada de bitácora
- **THEN** el sistema guarda un log con el usuario, la fecha, la hora y los cambios realizados
