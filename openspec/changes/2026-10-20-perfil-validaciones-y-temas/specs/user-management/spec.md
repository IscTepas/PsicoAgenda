# Spec Delta

## ADDED Requirements

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
