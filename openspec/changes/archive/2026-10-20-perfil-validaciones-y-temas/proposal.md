# Proposal

## Why

El perfil permite editar campos que la API no valida: el teléfono acepta letras y cualquier longitud (`z.string()`), la zona horaria cualquier texto, el nombre no tiene máximo y el contacto de emergencia se puede guardar a medias (la API lo rechaza al final). Además, el correo se puede escribir aunque **nunca se envía**: la pantalla muestra "¡Cambios guardados!" sin haber cambiado nada. Los teléfonos del perfil tampoco usan la máscara que ya tiene el registro. Por último, el tema de interfaz se limita a claro/oscuro/sistema.

## What Changes

- Validación real (compartida web/API): nombre 2–120, teléfono de 10 dígitos si viene, zona horaria de una lista cerrada, foto como data URL de imagen o https con tope, contacto de emergencia con nombre y teléfono juntos, cédula del psicólogo con formato.
- El perfil usa la máscara de teléfono del registro (10 dígitos, `555-123-4567`) en el teléfono y el de emergencia, y reformatea los valores guardados al cargar.
- El correo pasa a **solo lectura** (se cambia desde Auth, no desde el perfil).
- Se quita el badge **"Rol: …"** de la cabecera del perfil.
- **Modo y paleta como preferencias independientes**: el modo (claro/oscuro/automático) se elige con un **control segmentado** y la paleta con **tarjetas de muestra**. Siete paletas —Océano, Bosque, Atardecer, Lavanda, Cereza, Sepia y Alto contraste—, con **Alto contraste separado** por accesibilidad y un botón **Restablecer** que vuelve al tema de la marca. El **wordmark** del sidebar toma el color de la paleta; el icono PNG conserva los colores de marca.

## Capabilities

### Modified Capabilities

- `user-management`: se añaden las reglas de validación del perfil y las preferencias de tema de interfaz.

### New Capabilities

(None)

## Impact

- `packages/shared/src/schemas/index.ts`: `updatePatientProfileSchema`, `updatePsychologistProfileSchema`, `timezoneSchema`, `photoUrlSchema`.
- `packages/shared/src/constants/index.ts`: lista `TIMEZONES`.
- `apps/web/src/lib/telefono.ts` y `apps/web/src/components/telefono-input.tsx`: máscara reutilizable (antes vivía en el registro).
- `apps/web/src/app/(app)/perfil/pantalla-perfil-usuario.tsx`: validaciones, máscara, correo de solo lectura, sin badge de rol, nuevas opciones de tema.
- `apps/web/src/lib/theme.ts`, `use-theme.tsx`, `components/theme-picker.tsx` y `app/globals.css`: siete paletas, selector con muestras, wordmark por tema y persistencia.
- Sin cambios de base de datos ni de contrato de la API (solo se endurecen los esquemas que ya existían).
