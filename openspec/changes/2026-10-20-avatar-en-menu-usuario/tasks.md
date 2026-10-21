# Tasks

## 1. Foto en la sesión

- [x] 1.1 Añadir `photoUrl` a `SessionUser` en `packages/shared` y reconstruir el paquete
- [x] 1.2 Devolver `photoUrl` desde `GET /api/auth/me` (`getProfileById` lee `foto_perfil_url`)
- [x] 1.3 Consultar `/auth/me` una vez en `SessionProvider`, asociar la foto al usuario y exponer `updatePhoto`

## 2. Avatar en el menú

- [x] 2.1 Mostrar la foto en la tarjeta de usuario de `app-shell.tsx` (sidebar y drawer móvil) con las iniciales como respaldo
- [x] 2.2 Refrescar la tarjeta tras cargar y guardar el perfil mediante `updatePhoto`

## 3. Compresión y teléfono opcional

- [x] 3.1 Crear `lib/imagen.ts` con `dimensionesAvatar` y `comprimirAvatar` (máximo 512 px, WebP con JPEG de respaldo)
- [x] 3.2 Usar la compresión al elegir la imagen del perfil y mostrar un error si no se puede procesar
- [x] 3.3 Quitar el `required` del teléfono de contacto del perfil

## 4. Verificación

- [x] 4.1 Tests de `dimensionesAvatar` (web **64/64**; API **108/108**)
- [x] 4.2 `npm run typecheck` y `npm run lint` sin errores
- [x] 4.3 Prueba de UI con Playwright: una imagen de 783 KB se guarda como WebP de 512×410 (~5 KB); la tarjeta del sidebar muestra la foto y su `src` coincide con la guardada; el drawer móvil muestra la misma foto; consola sin errores
- [x] 4.4 Verificar que el guardado con el teléfono vacío completa el PATCH (antes lo bloqueaba la validación nativa)

## Workflow follow-up

- Archivar el cambio tras la revisión y `openspec validate` en verde.
