# Tareas — 2026-09-26 Planificar arquitectura del monorepo PsicoAgenda

## Completadas

- [x] Definir estructura de monorepo (`apps/` + `packages/`).
- [x] Elegir stack tecnológico frontend (Next.js 16 App Router + Serwist PWA).
- [x] Elegir stack tecnológico backend (Express 5 + TypeScript + Prisma 7 + PostgreSQL).
- [x] Elegir herramientas de UI (Tailwind CSS v4 + shadcn/ui Radix Nova).
- [x] Crear change formal de OpenSpec `2026-09-26-planificar-arquitectura`.
- [x] Escribir `proposal.md`, `design.md` y `tasks.md` del change.
- [x] Configurar `package.json` root con workspaces y project references de TypeScript.
- [x] Crear `tsconfig.base.json` y `tsconfig.json` solución en la raíz.
- [x] Crear `packages/shared` con tipos, esquemas, constantes y exports ESM.
- [x] Crear `apps/api` con Express + TypeScript + estructura base + tests.
- [x] Configurar Prisma 7 en `apps/api` (`prisma.config.ts`, `schema.prisma`, `src/lib/prisma.ts`).
- [x] Crear `apps/web` con Next.js 16 + App Router + estructura base.
- [x] Configurar Tailwind CSS v4 y shadcn/ui en `apps/web`.
- [x] Configurar PWA en `apps/web` (`manifest.ts`, `serwist.config.mjs`, `sw.ts`, iconos).
- [x] Agregar middleware base de autenticación y validación en `apps/api`.
- [x] Actualizar `README.md` con instrucciones de instalación y desarrollo del monorepo.
- [x] Configurar ESLint 9 + Vitest en `apps/api` y limpiar scripts cross-platform.
- [x] Validar estructura del monorepo.

## Pendientes de implementación

- [ ] Ejecutar `prisma migrate dev` cuando haya un PostgreSQL disponible.
- [ ] Definir despliegue en un change posterior.

## Comandos de desarrollo

```bash
# Instalar dependencias del monorepo
npm install

# Levantar backend
npm run dev:api

# Levantar frontend
npm run dev:web

# Levantar ambos (concurrently)
npm run dev

# Generar tipos de Prisma
npm run prisma:generate

# Typecheck de todo el monorepo
npm run typecheck

# Lint de todo el monorepo
npm run lint

# Tests de la API
npm test

# Construir todo (shared → api → web + service worker)
npm run build
```
