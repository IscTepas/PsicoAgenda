# Tasks: Acceso por rol

- [x] Crear change OpenSpec `2026-09-27-acceso-por-rol` con proposal, design y delta de spec.
- [x] Shared: agregar `demoLoginSchema` y `SessionUser`; corregir `createUserSchema.role` para excluir `ADMIN`.
- [x] API: agregar `allowDemoLogin` a config y `.env.example`.
- [x] API: crear `auth.routes.ts`, `auth.controller.ts` y `auth.service.ts` para `POST /api/auth/demo-login`.
- [x] API: montar `/auth` en `routes/index.ts`.
- [x] API: agregar test `tests/auth.demo.test.ts`.
- [x] Prisma: agregar `role UserRole @default(PATIENT)` al modelo `User`.
- [x] Prisma: generar migración offline del esquema completo.
- [x] Web: crear `session.ts` y `use-session.tsx` con `localStorage` + cookie.
- [x] Web: crear `demo-login-buttons.tsx` y actualizar `login/page.tsx`.
- [x] Web: crear `proxy.ts` con redirecciones por cookie.
- [x] Web: actualizar `(app)/layout.tsx` con `SessionProvider`.
- [x] Web: filtrar `NAV_ITEMS` por rol y agregar "Salir" en `app-shell.tsx`.
- [x] Validar `typecheck`, `lint`, `build`, `test` y smoke de rutas.
- [ ] Archivar change y crear espejo en Obsidian.
