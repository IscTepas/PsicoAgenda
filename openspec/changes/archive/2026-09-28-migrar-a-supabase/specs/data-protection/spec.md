## ADDED Requirements

### Requirement: No almacenamiento de contraseñas
El sistema SHALL NOT almacenar contraseñas de usuarios ni en texto legible ni cifradas con una clave que el sistema controle. El cifrado y la verificación de contraseñas SHALL delegarse al proveedor de identidad.

#### Scenario: Alta de usuario
- **WHEN** un usuario crea una cuenta
- **THEN** el sistema persiste únicamente el perfil y la referencia a la identidad, sin columna de contraseña en su base de datos

#### Scenario: Consulta al almacén de datos
- **WHEN** se inspecciona el esquema de la base de datos de la aplicación
- **THEN** no existe ningún campo que almacene una contraseña ni su equivalente cifrado

## MODIFIED Requirements

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

### Requirement: Confidencialidad profesional
El sistema SHALL asegurar que la información clínica solo sea accesible para usuarios autorizados. La única vía de acceso a los datos clínicos SHALL ser la del backend, y el sistema SHALL mantener cerrada cualquier vía de acceso pública a la base de datos que la plataforma pueda ofrecer.

#### Scenario: Acceso restringido a historial
- **WHEN** un usuario intenta acceder a un historial clínico
- **THEN** el sistema verifica sus permisos y permite el acceso solo si está autorizado

#### Scenario: Intento de lectura directa de la base de datos
- **WHEN** se intenta leer las tablas clínicas saltándose el backend con una clave pública de la plataforma
- **THEN** la vía de acceso pública está deshabilitada y la lectura no es posible
