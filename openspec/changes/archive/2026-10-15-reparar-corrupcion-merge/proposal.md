# Proposal: Reparar la corrupción del merge en `main` (web + cliente Prisma)

## Contexto

El merge `8c6e8d6` ("Merge branch 'main' into Christian") combinó la rama `main` con la rama `Christian` y dejó el árbol en un estado inconsistente:

- **Frontend (`apps/web`)**: se conservó el *render* de `main` pero se perdieron los imports, definiciones de estado y props que ese render consumía. Además, `appointment-form.tsx` quedó con fragmentos de las dos versiones (estado duplicado, símbolos sin definir y un flag de guardado partido en `isSaving`/`isSubmitting`).
- **Backend (`apps/api`)**: el cliente Prisma generado en `src/generated/prisma` quedó desactualizado respecto a `prisma/schema.prisma` (esquema en español de `Christian`), por lo que los servicios no compilaban (`start` vs `startTime`, `User.role`, `SessionType`, `cancelReason`, etc.).
- **Runtime**: el dashboard mostraba en consola el warning de React 19 `Encountered a script tag while rendering React component`, originado por un `<script>` crudo en el layout raíz.

## Objetivo

Dejar `main` coherente y funcional —compilación, lint, pruebas y ejecución en desarrollo sin errores— restaurando el comportamiento correcto y eliminando el warning de consola del dashboard.

## Alcance

- `apps/web/src/app/layout.tsx`: sustituir el `<head>`/`<script>` crudos por `next/script` con `strategy="beforeInteractive"`.
- Hidratación: nuevo hook `apps/web/src/lib/use-hydrated.ts` y lectura del tema con `useSyncExternalStore`; *gating* de valores dependientes del tiempo (`new Date()`) en calendario, dashboard, expediente clínico y formulario de cita.
- Reparar los símbolos rotos por el merge en `agenda-client.tsx`, `dashboard-view.tsx` y `appointment-form.tsx` (imports, props, estado duplicado/muerto, unificación de `isSubmitting`).
- `apps/api`: regenerar el cliente Prisma (`prisma generate`) conforme a `schema.prisma`.

## Out of scope / Non-goals

- No se modifica `schema.prisma` ni se añaden migraciones.
- No se agregan funcionalidades ni endpoints.
- No se reescriben las specs del proyecto (`skip_specs: true`).

## Impacto esperado

- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` en verde para `apps/api` y `apps/web`.
- El dashboard deja de emitir el warning de React sobre `<script>`.
- El servidor de desarrollo sirve `/` y `/login` con HTTP 200.

## Riesgos y deuda técnica conocida

- El cliente Prisma generado está en `.gitignore`; un clon limpio debe ejecutar `prisma generate` (cubierto por el flujo de build/dev). Se documenta por si se requiere un paso explícito de bootstrap.
- La reparación preserva el *render* de `main` sobre el esquema de `Christian`; futuras divergencias entre ramas deben resolverse con merge explícito, no automático.
