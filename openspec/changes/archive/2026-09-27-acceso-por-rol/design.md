# Diseño: Acceso por rol

## Decisiones

1. **Token de sesión**
   - Se firma con `jsonwebtoken` usando `signToken` ya existente en `apps/api/src/utils/jwt.ts`.
   - Payload: `{ sub: demo-id, email: demo-email, role }`.
   - El token se devuelve al frontend y se guarda en `localStorage`.

2. **Proxy (`proxy.ts`)**
   - Archivo en `apps/web/src/proxy.ts`, junto a `src/app/`.
   - Lee la cookie `pa_session`.
   - Si la cookie falta y la ruta está bajo `(app)` (dashboard, agenda, pacientes, etc.), redirige a `/login`.
   - Si la cookie existe y la ruta es `/login` o `/registro`, redirige a `/dashboard`.
   - No intenta verificar el JWT: es solo protección de UI.

3. **Cookie de sesión**
   - `document.cookie = "pa_session=1; path=/; SameSite=Lax"` al guardar sesión.
   - Se borra al cerrar sesión.
   - Es una bandera, no contiene el token.

4. **Sesión en el cliente**
   - `src/lib/session.ts` centraliza `saveSession`, `readSession`, `clearSession`.
   - `useSession` hook lee del `localStorage` y expone `{ user, isLoading }`.
   - `SessionProvider` envuelve el layout de `(app)`.
   - `app-shell.tsx` consume el rol para filtrar `NAV_ITEMS`.

5. **Demo login en API**
   - `POST /api/auth/demo-login` recibe `{ role }`.
   - Validado con `demoLoginSchema` del shared.
   - Responde 404 en producción o si `ALLOW_DEMO_LOGIN` no está activo.
   - Emite un JWT con datos fijos por rol.

6. **Prisma**
   - Se agrega `role UserRole @default(PATIENT)` al modelo `User`.
   - Se genera la migración offline con `prisma migrate diff --from-empty --to-schema-datamodel`.
   - Como es la primera migración del proyecto, contendrá el DDL completo.

## Archivos afectados

- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/index.ts`
- `apps/api/src/config/index.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/routes/auth.routes.ts` (nuevo)
- `apps/api/src/controllers/auth.controller.ts` (nuevo)
- `apps/api/src/services/auth.service.ts` (nuevo)
- `apps/api/.env.example`
- `apps/api/tests/auth.demo.test.ts` (nuevo)
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/...` (nuevo)
- `apps/web/src/lib/session.ts` (nuevo)
- `apps/web/src/lib/use-session.ts` (nuevo)
- `apps/web/src/proxy.ts` (nuevo)
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/login/demo-login-buttons.tsx` (nuevo)
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/(app)/components/app-shell.tsx`
