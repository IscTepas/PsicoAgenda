# Design

## Context

La foto se guarda en `usuarios.foto_perfil_url` como data URL base64 y se edita en la pantalla de perfil, que la obtiene de `GET /api/patients/me` o `/api/psychologists/me`. El menú (`app-shell.tsx`) pinta la tarjeta de usuario con `getInitials(displayName)`; la sesión de la web se deriva de Supabase (`readIdentity`) y no conoce la foto. El guardado del perfil sube el archivo original sin comprimir.

## Goals / Non-Goals

**Goals:**

- Que la foto se vea en la tarjeta de usuario del sidebar y del drawer móvil.
- Mantener el costo de `/auth/me` bajo, sin mover la foto a otro almacenamiento.
- Refrescar la tarjeta al guardar, sin recargar la página.
- Corregir el `required` que impedía guardar con el teléfono vacío.

**Non-Goals:**

- Migrar las fotos a Supabase Storage (sigue el data URL en la base).
- Añadir un avatar en el header móvil junto al botón hamburguesa.
- Cambiar el flujo de autenticación ni el proveedor de identidad.

## Decisions

### 1. La foto viaja en `/auth/me`, no en el token

`getProfileById` selecciona también `foto_perfil_url` y lo devuelve como `photoUrl`. La alternativa de guardar la foto en `user_metadata` de Supabase se descarta: el token viaja en cada petición y un data URL de imagen lo inflaría; además el cliente no puede editar `app_metadata`.

### 2. Comprimir el avatar al elegir la imagen

`apps/web/src/lib/imagen.ts` redimensiona a un máximo de 512 px por el lado mayor con canvas y exporta WebP (~0.85), con JPEG como respaldo. El cálculo de dimensiones (`dimensionesAvatar`) es puro y se prueba con Vitest. Sin esto, incluir el original en `/auth/me` descargaría hasta ~4 MB en cada carga de la app; con la compresión la prueba real pasó de 783 KB de PNG a ~5 KB de WebP.

### 3. El `SessionProvider` mezcla identidad y foto

Tras tener el usuario de Supabase, el proveedor pide `/auth/me` con `apiFetch` (que resuelve el token) y guarda `{ userId, photoUrl }`. La foto solo se usa si el `userId` coincide con la sesión actual, así no se reutiliza la imagen anterior al cambiar de cuenta; si la petición falla se cae a las iniciales. `updatePhoto` permite que el perfil refresque la tarjeta al guardar o al cargar la foto desde su propio endpoint, sin otra petición.

### 4. Respaldo con iniciales

La tarjeta renderiza un `<img>` cuando hay `user.photoUrl` y, si no, el círculo con iniciales que ya existía. Se usa `<img>` (con la excepción de ESLint) porque el valor es un data URL, igual que en la pantalla de perfil.

### 5. Teléfono opcional de verdad

La validación del cliente ya permite el teléfono vacío y la API lo acepta, pero el `TelefonoInput` del perfil tenía `required`, lo que activaba la validación nativa del navegador y bloqueaba el submit. Se elimina ese atributo; la regla de 10 dígitos sigue aplicándose cuando hay valor.
