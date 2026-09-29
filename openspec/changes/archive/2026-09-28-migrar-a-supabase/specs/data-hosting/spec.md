## Purpose

Dependencia de la plataforma de datos: dónde se persisten los datos del sistema, cómo se alcanza esa base de datos de forma cifrada y agrupada, dónde termina la responsabilidad del código de aplicación sobre los schemas que administra el proveedor, y cómo se aplican los cambios de esquema.

## ADDED Requirements

### Requirement: Persistencia en PostgreSQL gestionado

El sistema SHALL persistir sus datos de dominio en un servicio de PostgreSQL gestionado, al que SHALL acceder mediante una conexión agrupada y cifrada, sin requerir la instalación local de un servidor de base de datos.

#### Scenario: Arranque del backend con la base de datos configurada
- **WHEN** el backend inicia con la configuración de conexión presente
- **THEN** el sistema establece la conexión sobre un canal cifrado y queda disponible para atender peticiones

#### Scenario: Configuración de conexión ausente
- **WHEN** el backend arranca en un entorno que exige configuración obligatoria y la conexión no está definida
- **THEN** el sistema se niega a iniciar y señala qué variable falta, en lugar de operar sin persistencia

#### Scenario: Uso del pool de conexiones
- **WHEN** llegan peticiones concurrentes al backend
- **THEN** el sistema reutiliza un número acotado y explícito de conexiones, sin abrir una conexión nueva por petición ni agotar el límite del servicio de base de datos

### Requirement: Frontera con los schemas administrados por el proveedor

El sistema SHALL gestionar exclusivamente el schema de la aplicación y SHALL NOT leer ni escribir desde el código de aplicación los schemas de identidad y archivos que administra el proveedor de la plataforma.

#### Scenario: El proveedor actualiza sus schemas internos
- **WHEN** el proveedor modifica la estructura de sus schemas internos
- **THEN** el sistema no detecta esas modificaciones como desviación de su propio esquema y no propone revertirlas

#### Scenario: Detección de desviación
- **WHEN** el esquema de la aplicación difiere de lo que las migraciones declara
- **THEN** el sistema informa la desviación antes de aplicar cambios, en lugar de sobrescribirla silenciosamente

### Requirement: Perfil de usuario sincronizado con el proveedor de identidad

El sistema SHALL mantener en su propio schema un perfil por cada identidad administrada por el proveedor, SHALL NOT almacenar contraseñas, y SHALL mantener sincronizados el correo y el estado de la cuenta ante altas, cambios de correo, bloqueos y eliminaciones.

#### Scenario: Alta de una identidad
- **WHEN** el proveedor de identidad registra una identidad nueva
- **THEN** el sistema crea el perfil correspondiente con el mismo identificador, sin solicitar ni almacenar la contraseña

#### Scenario: Cambio de correo
- **WHEN** se actualiza el correo de una identidad
- **THEN** el sistema refleja el nuevo correo en el perfil

#### Scenario: Bloqueo de la cuenta
- **WHEN** el proveedor de identidad bloquea una cuenta
- **THEN** el sistema marca el perfil como no activo y deja de tratarla como usuaria habilitada

#### Scenario: Eliminación de la identidad
- **WHEN** se elimina una identidad en el proveedor
- **THEN** el sistema elimina el perfil y los datos asociados según las reglas de retención

### Requirement: Aplicación versionada de cambios de esquema

El sistema SHALL aplicar los cambios de esquema exclusivamente mediante migraciones versionadas, y en entornos de publicación SHALL NOT crear bases de sombra ni regenerar migraciones.

#### Scenario: Desarrollo de un cambio de esquema
- **WHEN** un desarrollador modifica el esquema y ejecuta el flujo de migración en desarrollo
- **THEN** el sistema usa una base de sombra aislada para detectar problemas antes de aplicar el cambio a la base de desarrollo

#### Scenario: Publicación de migraciones pendientes
- **WHEN** se despliega el backend con migraciones pendientes
- **THEN** el sistema aplica únicamente las migraciones pendientes y falla de forma explícita si el historial no corresponde al esquema
