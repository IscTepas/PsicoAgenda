# 2026-09-26 Planificar arquitectura del monorepo PsicoAgenda

## Why
PsicoAgenda necesita una base técnica clara y escalable para separar responsabilidades entre frontend, backend y código compartido. Actualmente el repositorio solo contiene documentación y especificaciones; no existe código de aplicación ni una estructura de proyecto definida. Establecer un monorepo desde el inicio facilita:

- Compartir tipos y validaciones entre frontend y backend.
- Mantener sincronizados los entornos de desarrollo.
- Escalar el proyecto sin fragmentar el código en múltiples repositorios.
- Alinear el desarrollo con las especificaciones de OpenSpec.

## What Changes

### Incluye
- Configuración de un monorepo con `apps/` y `packages/` usando npm workspaces.
- Creación de `apps/api`: backend ESM con Express.js 5, TypeScript, Prisma 7 (driver adapter PostgreSQL), tests con Vitest + Supertest y middleware base de autenticación y validación.
- Creación de `apps/web`: frontend con Next.js 16, App Router, Tailwind CSS v4, shadcn/ui y PWA con Serwist (modo configurator compatible con Turbopack).
- Creación de `packages/shared`: tipos, esquemas de validación Zod y constantes compartidas.
- TypeScript solution file con project references para ordenar el build `shared → api`.
- Actualización del `README.md` con instrucciones de desarrollo del monorepo.

### No incluye
- Implementación completa de RF/RNF (solo estructura base y configuración).
- Configuración de servidores de producción o despliegue.
- Integración real con WhatsApp Business API o correo (solo preparación del stack).
- Base de datos poblada o migraciones definitivas (`migrate dev` requiere PostgreSQL).

## Estado
Implementado el 2026-09-27. Pendiente de archivo en OpenSpec.
