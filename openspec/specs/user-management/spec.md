## Purpose
Gestión de usuarios del sistema: registro de pacientes y psicólogos/as, autenticación, perfiles, recuperación de contraseñas y control de roles y permisos. Incluye el manejo de tutores legales para pacientes menores de edad.

## Requirements

### Requirement: Registro de usuarios
El sistema SHALL permitir que nuevos pacientes y psicólogos/as creen una cuenta proporcionando datos básicos, validando la información y verificando el correo electrónico.

#### Scenario: Registro exitoso de paciente
- **WHEN** un usuario proporciona nombre, correo electrónico, contraseña y tipo de usuario
- **THEN** el sistema valida los datos, verifica que el correo no exista, cifra la contraseña y crea la cuenta con un mensaje de confirmación

#### Scenario: Registro de paciente menor de edad
- **WHEN** se registra un paciente menor de edad
- **THEN** el sistema solicita y vincula los datos del tutor legal y registra el consentimiento informado correspondiente

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

### Requirement: Gestión de perfil de usuario
El sistema SHALL permitir a los usuarios consultar y actualizar su información personal y preferencias.

#### Scenario: Actualización de perfil
- **WHEN** un usuario modifica campos permitidos de su perfil
- **THEN** el sistema valida el formato, guarda los cambios y confirma la actualización

### Requirement: Recuperación de contraseña
El sistema SHALL permitir restablecer la contraseña mediante un enlace o clave temporal segura con tiempo límite.

#### Scenario: Solicitud de recuperación
- **WHEN** un usuario solicita recuperar su contraseña con su correo registrado
- **THEN** el sistema genera un enlace o clave temporal segura, la envía al correo y permite el restablecimiento dentro del tiempo límite

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

### Requirement: Teléfono y declaración de minoría en el registro

El sistema SHALL validar los teléfonos del registro (personal, contacto de emergencia y tutor legal) como números locales de exactamente 10 dígitos, presentándolos con el formato `555-123-4567`. El sistema SHALL ofrecer la declaración de si la cuenta es para un menor de edad y SHALL mantenerla coherente con la fecha de nacimiento, que es la fuente de verdad para exigir los datos del tutor legal.

#### Scenario: Teléfono con formato local

- **WHEN** una persona escribe o pega un teléfono en el formulario de registro
- **THEN** el sistema conserva solo los dígitos, los agrupa como `555-123-4567` y no admite más de 10 dígitos

#### Scenario: Teléfono incompleto

- **WHEN** el teléfono tiene menos de 10 dígitos
- **THEN** el sistema no permite enviar el registro e indica que faltan dígitos

#### Scenario: Declaración de minoría coherente con la fecha

- **WHEN** la persona declara que registra a un menor y la fecha de nacimiento corresponde a un mayor de edad (o al contrario)
- **THEN** el sistema muestra el error en la fecha y no deja continuar hasta que ambas coincidan

#### Scenario: Registro de un menor

- **WHEN** la fecha de nacimiento corresponde a un menor de 18 años
- **THEN** el sistema muestra la sección del tutor legal antes de los datos de acceso y exige sus datos y consentimiento, sin importar lo que se haya declarado en el selector

#### Scenario: Teléfono de contacto de un menor

- **WHEN** la cuenta es para un menor de edad
- **THEN** el sistema usa el teléfono del tutor legal como teléfono de contacto del alta y deja deshabilitado el teléfono personal

### Requirement: Validación del perfil de usuario

El sistema SHALL validar los datos del perfil de paciente y de psicólogo antes de guardarlos, con las mismas reglas en la web y en la API: nombre de 2 a 120 caracteres, teléfono de exactamente 10 dígitos cuando se proporcione, zona horaria de la lista admitida, foto como imagen o URL https dentro del tope, contacto de emergencia con nombre y teléfono en conjunto, y cédula del psicólogo con formato. El correo electrónico SHALL mostrarse como dato de solo lectura.

#### Scenario: Teléfono con formato local

- **WHEN** la persona escribe o pega un teléfono en el perfil
- **THEN** el sistema lo presenta como `555-123-4567`, no admite más de 10 dígitos y, si trae lada, usa los últimos 10

#### Scenario: Teléfono inválido

- **WHEN** el teléfono tiene menos de 10 dígitos o contiene letras
- **THEN** el sistema muestra el error y no guarda el perfil

#### Scenario: Nombre fuera de rango

- **WHEN** el nombre tiene menos de 2 o más de 120 caracteres
- **THEN** el sistema muestra el error y no guarda el perfil

#### Scenario: Zona horaria no admitida

- **WHEN** la zona horaria no pertenece a la lista del sistema
- **THEN** la API rechaza la petición con un error de validación

#### Scenario: Foto no válida

- **WHEN** la foto no es una imagen PNG, JPG o WebP ni una URL https, o supera el tope de tamaño
- **THEN** el sistema muestra el error y no guarda el perfil

#### Scenario: Contacto de emergencia incompleto

- **WHEN** se envía solo el nombre o solo el teléfono del contacto de emergencia
- **THEN** el sistema muestra el error antes de enviar y no guarda nada

#### Scenario: Correo de solo lectura

- **WHEN** la persona consulta su perfil
- **THEN** el correo se muestra sin permitir editarlo y se indica que se cambia desde la cuenta

### Requirement: Modo y paleta de tema independientes

El sistema SHALL tratar el modo de luminosidad (claro, oscuro, automático) y la paleta de color como preferencias independientes, aplicar ambas de inmediato y conservarlas entre recargas. SHALL permitir restablecer el tema de la marca.

#### Scenario: Elección de una paleta

- **WHEN** la persona elige una paleta en el perfil
- **THEN** el sistema aplica su acento al instante sin cambiar el modo claro/oscuro elegido

#### Scenario: Modo y paleta independientes

- **WHEN** la persona elige la paleta Cereza y luego el modo Oscuro
- **THEN** el sistema aplica la paleta Cereza en modo oscuro y mantiene ambos controles con su estado activo

#### Scenario: Restablecer el tema

- **WHEN** la persona pulsa Restablecer
- **THEN** el sistema vuelve al modo automático con la paleta de la marca y deshabilita el botón por no haber nada que restablecer

#### Scenario: Persistencia del tema

- **WHEN** la persona recarga la aplicación
- **THEN** el modo y la paleta elegidos se mantienen aplicados desde el primer render, sin destello

### Requirement: Selector visual de temas

El sistema SHALL presentar el modo como control segmentado con el activo resaltado, las seis paletas estéticas como tarjetas con muestras en una cuadrícula y Alto contraste separado por accesibilidad. El wordmark SHALL usar el color de la paleta activa y SHALL conservarse la selección guardada con el formato anterior.

#### Scenario: Selector visual

- **WHEN** la persona abre las preferencias de tema
- **THEN** ve el modo como control segmentado y las seis paletas estéticas como tarjetas en una cuadrícula equilibrada, con Alto contraste separado y la opción de restablecer

#### Scenario: Wordmark con la paleta

- **WHEN** la persona elige una paleta
- **THEN** el wordmark "PsicoAgenda" del sidebar toma el color de esa paleta mientras el icono conserva los colores de marca

#### Scenario: Preferencias guardadas con el formato anterior

- **WHEN** la persona tenía guardada una paleta con el formato combinado anterior
- **THEN** el sistema la interpreta como modo automático con esa paleta y normaliza las claves

### Requirement: Foto de perfil en el menú

El sistema SHALL mostrar la foto de perfil vigente en la tarjeta de usuario del menú lateral y del drawer móvil, con las iniciales como respaldo cuando no haya foto. La foto SHALL comprimirse antes de almacenarse y la tarjeta SHALL actualizarse sin recargar la página después de guardarla en el perfil.

#### Scenario: Menú con foto

- **WHEN** la persona con foto de perfil inicia sesión o carga la aplicación
- **THEN** la tarjeta de usuario del sidebar y el drawer móvil muestran su foto en lugar de las iniciales

#### Scenario: Menú sin foto

- **WHEN** la persona no tiene foto de perfil o la consulta del perfil falla
- **THEN** la tarjeta muestra las iniciales y la aplicación sigue funcionando con normalidad

#### Scenario: Actualización al guardar

- **WHEN** la persona guarda una foto nueva en el perfil
- **THEN** la tarjeta del menú muestra la foto nueva sin necesidad de recargar

#### Scenario: Avatar comprimido

- **WHEN** la persona elige una imagen mayor que 512 px
- **THEN** el sistema la reduce a un máximo de 512 px por el lado mayor y la guarda como WebP (o JPEG si el navegador no soporta WebP en canvas)

#### Scenario: Teléfono opcional del perfil

- **WHEN** la persona deja vacío el teléfono de contacto y guarda el perfil
- **THEN** el formulario no se bloquea por validación nativa y guarda el resto de los cambios; si escribe un teléfono, sigue exigiendo 10 dígitos
