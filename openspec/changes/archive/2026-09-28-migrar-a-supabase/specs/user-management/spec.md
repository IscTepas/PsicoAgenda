## MODIFIED Requirements

### Requirement: Autenticación
El sistema SHALL verificar la identidad del usuario al iniciar sesión y otorgar acceso según su rol. La validación de la sesión SHALL realizarse comprobando criptográficamente la firma del token de acceso contra las claves publicadas por el proveedor de identidad, y el sistema SHALL rechazar todo token que no supere esa comprobación.

#### Scenario: Inicio de sesión válido
- **WHEN** un usuario ingresa correo y contraseña correctos
- **THEN** el proveedor de identidad emite una sesión y la redirige a la interfaz correspondiente a su rol

#### Scenario: Inicio de sesión inválido
- **WHEN** un usuario ingresa credenciales incorrectas
- **THEN** el sistema muestra un mensaje de error y no emite ninguna sesión

#### Scenario: Petición con token manipulado
- **WHEN** una petición llega con un token alterado, caducado o firmado con una clave que no es del proyecto
- **THEN** el sistema la rechaza y no ejecuta ninguna acción, tampoco de solo lectura

#### Scenario: Petición sin token
- **WHEN** una petición llega sin credencial de sesión
- **THEN** el sistema la rechaza antes de resolver cualquier dato de negocio

### Requirement: Control de roles y permisos
El sistema SHALL restringir las funciones disponibles según el rol del usuario: paciente, psicólogo/a o sistema. El rol SHALL obtenerse de un atributo de sesión que el usuario no pueda modificar por sí mismo, y el sistema SHALL NOT conceder un rol por omisión cuando la sesión no lo declara.

#### Scenario: Acceso por rol
- **WHEN** un usuario autenticado accede al sistema
- **THEN** el sistema identifica su rol y muestra solo las opciones permitidas
- **AND** el sistema redirige a usuarios sin sesión a la pantalla de login

#### Scenario: Manipulación del rol desde el cliente
- **WHEN** un usuario intenta declararse con un rol superior desde el navegador
- **THEN** el sistema conserva el rol emitido por el proveedor de identidad e ignora el declarado por el cliente

#### Scenario: Sesión sin rol declarado
- **WHEN** una sesión válida no declara un rol de aplicación
- **THEN** el sistema rechaza el acceso en lugar de asumir el rol de menor privilegio
