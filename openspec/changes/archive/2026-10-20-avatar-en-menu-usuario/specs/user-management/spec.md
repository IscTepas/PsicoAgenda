# Spec Delta

## ADDED Requirements

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
