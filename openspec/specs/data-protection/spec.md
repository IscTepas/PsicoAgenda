## Purpose
Protección de datos personales y clínicos: cifrado, control de sesiones, autenticación segura, ausencia de contraseñas en la base de datos de la aplicación, cumplimiento de la LFPDPPP, respaldo en AWS, retención de expedientes, portabilidad de datos y auditoría de accesos.

## Requirements

### Requirement: No almacenamiento de contraseñas
El sistema SHALL NOT almacenar contraseñas de usuarios ni en texto legible ni cifradas con una clave que el sistema controle. El cifrado y la verificación de contraseñas SHALL delegarse al proveedor de identidad.

#### Scenario: Alta de usuario
- **WHEN** un usuario crea una cuenta
- **THEN** el sistema persiste únicamente el perfil y la referencia a la identidad, sin columna de contraseña en su base de datos

#### Scenario: Consulta al almacén de datos
- **WHEN** se inspecciona el esquema de la base de datos de la aplicación
- **THEN** no existe ningún campo que almacene una contraseña ni su equivalente cifrado

### Requirement: Cifrado de datos
El sistema SHALL cifrar los datos en tránsito y en almacenamiento, especialmente contraseñas e información clínica. El cifrado en tránsito SHALL cubrir tanto las comunicaciones con la base de datos como la validación de las sesiones, y esta última SHALL realizarse con verificación de firma asimétrica, sin depender de un secreto compartido distribuido entre servicios.

#### Scenario: Almacenamiento seguro
- **WHEN** se guarda información sensible en la base de datos
- **THEN** el sistema almacena la información cifrada aplicando algoritmos seguros

#### Scenario: Conexión a la base de datos
- **WHEN** el backend abre una conexión con la base de datos
- **THEN** la conexión se negocia sobre un canal cifrado y el sistema no acepta operar sobre ella en texto plano

#### Scenario: Validación de sesión sin secreto compartido
- **WHEN** el backend valida un token de sesión
- **THEN** comprueba la firma contra las claves públicas publicadas por el proveedor de identidad, sin conservar ni distribuir ninguna clave que permita emitir tokens

### Requirement: Control de sesiones
El sistema SHALL crear sesiones únicas, controlar la inactividad y finalizar sesiones por expiración. El acceso SHALL concederse mediante credenciales de corta duración renovadas de forma transparente mientras la sesión siga vigente.

#### Scenario: Expiración por inactividad
- **WHEN** un usuario permanece inactivo más allá del tiempo permitido
- **THEN** el sistema cierra la sesión automáticamente y requiere autenticación nuevamente

#### Scenario: Renovación transparente de la sesión
- **WHEN** la credencial de acceso de un usuario caduca mientras la sesión continúa vigente
- **THEN** el sistema la renueva sin pedir credenciales y sin interrumpir la operación en curso

#### Scenario: Credencial de acceso expirada presentada al backend
- **WHEN** una petición llega con una credencial de acceso caducada
- **THEN** el sistema la rechaza y no ejecuta ninguna acción sobre los datos

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
El sistema SHALL asegurar que la información clínica solo sea accesible para usuarios autorizados. La única vía de acceso a los datos clínicos SHALL ser la del backend, y el sistema SHALL mantener cerrada cualquier vía de acceso público a la base de datos que la plataforma pueda ofrecer.

#### Scenario: Acceso restringido a historial
- **WHEN** un usuario intenta acceder a un historial clínico
- **THEN** el sistema verifica sus permisos y permite el acceso solo si está autorizado

#### Scenario: Intento de lectura directa de la base de datos
- **WHEN** se intenta leer las tablas clínicas saltándose el backend con una clave pública de la plataforma
- **THEN** la vía de acceso pública está deshabilitada y la lectura no es posible

### Requirement: Auditoría y trazabilidad
El sistema SHALL registrar acciones relevantes sobre datos sensibles para fines de auditoría.

#### Scenario: Registro de modificación clínica
- **WHEN** un profesional modifica una entrada de bitácora
- **THEN** el sistema guarda un log con el usuario, la fecha, la hora y los cambios realizados
