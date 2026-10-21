# Proposal

## Why

La foto de perfil solo se ve en la pantalla de perfil. El menú lateral y el drawer móvil (el del botón hamburguesa) muestran únicamente las iniciales, porque la sesión del proveedor (`id`, `email`, `name`, `role`) no incluye la foto y el menú nunca consulta el perfil de la API.

Además, el campo de teléfono del perfil conserva un `required` de HTML aunque la validación lo trata como opcional: con el teléfono vacío el navegador bloquea el envío del formulario y no se puede guardar nada, ni siquiera la foto.

## What Changes

- **La foto viaja en la sesión**: `GET /api/auth/me` devuelve `photoUrl` y `SessionUser` lo expone. El `SessionProvider` lo consulta una vez y lo mezcla con la identidad de Supabase.
- **Avatar en la tarjeta de usuario**: el menú lateral y el drawer móvil muestran la foto con las iniciales como respaldo. Tras guardar en el perfil, la tarjeta se actualiza sin recargar.
- **Avatar comprimido**: la foto se redimensiona a un máximo de 512 px y se guarda como WebP (JPEG si el navegador no soporta WebP en canvas). Así el `photoUrl` de `/auth/me` queda en decenas de KB en lugar de varios MB.
- **Corrección**: se quita el `required` del teléfono del perfil, para que el campo realmente sea opcional como indica la validación.

## Capabilities

### Modified Capabilities

- `user-management`: la foto de perfil se muestra en el menú y se comprime antes de guardarse.

### New Capabilities

(None)

## Impact

- `packages/shared/src/types/index.ts`: `SessionUser.photoUrl`.
- `apps/api/src/services/auth.service.ts`: `getProfileById` lee `foto_perfil_url`.
- `apps/web/src/lib/use-session.tsx`: consulta de `/auth/me`, fusión de la foto y `updatePhoto`.
- `apps/web/src/app/(app)/components/app-shell.tsx`: avatar de la tarjeta de usuario.
- `apps/web/src/app/(app)/perfil/pantalla-perfil-usuario.tsx`: compresión al elegir la imagen, `updatePhoto` al cargar/guardar y teléfono opcional.
- `apps/web/src/lib/imagen.ts` y `apps/web/tests/imagen.test.ts`: compresión y cálculo de dimensiones.
- Sin cambios de base de datos ni de contrato de la API más allá del campo nuevo en la respuesta de `/auth/me`.
