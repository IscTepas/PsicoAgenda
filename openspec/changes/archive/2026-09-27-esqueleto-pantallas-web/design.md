# Design: Esqueleto de pantallas web

## Decisiones

1. **Route group `(app)` para el área autenticada.**
   - El layout del grupo no renderiza `<html>`/`<body>` (ya existen en el root layout).
   - Login y registro quedan fuera del grupo para no heredar el sidebar.
2. **Sidebar simple y plegable.**
   - Componente Client Component con `useState` para el estado colapsado en desktop y abierto/cerrado en móvil.
   - Los links activos se resuelven con `usePathname` en el mismo componente, porque los layouts no re-renderizan al navegar.
3. **Datos mock centralizados.**
   - `src/lib/mock-data.ts` usa los tipos de `@psicoagenda/shared` para validar el dominio alineado en el change anterior.
4. **Formularios visuales con react-hook-form + zod.**
   - Login y registro usan `loginSchema`/`createUserSchema` del shared para validación cliente.
   - El submit solo redirige; no hay integración con API.
5. **Metadatos en Server Components.**
   - Las páginas que necesitan formularios (`login`, `registro`, `agenda/nueva`) separan el formulario en un Client Component y mantienen la página como Server Component para exportar `metadata`.

## Estructura de rutas

```
src/app/
├── login/page.tsx              (Server) + login-form.tsx (Client)
├── registro/page.tsx           (Server) + register-form.tsx (Client)
├── not-found.tsx               (Server)
├── page.tsx                    Landing actualizada
├── manifest.ts                 Shortcuts actualizados
└── (app)/
    ├── layout.tsx              Server wrapper
    ├── components/
    │   ├── app-shell.tsx       Client (sidebar + topbar)
    │   └── page-header.tsx     Server
    ├── dashboard/page.tsx
    ├── agenda/page.tsx
    ├── agenda/nueva/page.tsx   (Server) + new-appointment-form.tsx (Client)
    ├── pacientes/page.tsx
    ├── pacientes/[id]/page.tsx
    ├── notificaciones/page.tsx
    ├── reportes/page.tsx
    └── perfil/page.tsx
```

## Componentes shadcn

Instalados vía CLI: `input`, `label`, `select`, `textarea`, `table`, `tabs`, `separator`, `skeleton`, `dropdown-menu`, `avatar`, `alert`.
Creado manualmente: `form.tsx` (wrappers de react-hook-form).

## Navegación

`src/lib/navigation.ts` exporta `NAV_ITEMS` con `href`, `label`, `roles: UserRole[]`. Los íconos se mapean en `app-shell.tsx` para evitar dependencias de React en un archivo `.ts`.

## Mock data

- `MOCK_PSYCHOLOGIST`: psicólogo de ejemplo.
- `MOCK_PATIENTS`: 3 pacientes, incluyendo uno menor de edad con tutor legal.
- `MOCK_APPOINTMENTS`: 3 citas (confirmada, pendiente, completada).
- `MOCK_NOTIFICATIONS`: 2 notificaciones (enviada, pendiente).
- `MOCK_CLINICAL_RECORD`: expediente de ejemplo.

## Reglas de Next 16 aplicadas

- `params` es Promise; `/pacientes/[id]/page.tsx` hace `await params`.
- No se usa `legacyBehavior` en `Link`.
- No se activa `cacheComponents`.
- Se ejecuta `next typegen` antes de `typecheck` para generar los tipos de ruta.

## Validación

- `npm run typecheck` (raíz y web)
- `npm run lint`
- `npm run build`
- `npm test`
- Smoke de `npm run dev:web` sobre todas las rutas creadas y un 404.
