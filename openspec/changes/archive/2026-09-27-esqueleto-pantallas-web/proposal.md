# Proposal: Esqueleto de pantallas web

## Contexto

Con el monorepo y el dominio alineado, el siguiente paso es tener una estructura navegable de pantallas para validar flujos, recibir feedback visual y sentar las bases de la UX antes de implementar comportamiento real.

## Objetivo

Crear el esqueleto de la aplicación web: layout con sidebar, rutas principales y pantallas con datos mock, sin lógica de negocio ni integración con la API.

## Alcance

- Instalar componentes shadcn mínimos (input, label, form, select, textarea, table, tabs, separator, skeleton, dropdown-menu, avatar, alert) y crear `form.tsx` manual.
- Crear `src/lib/navigation.ts` con items de menú y `src/lib/mock-data.ts` con fixtures tipados.
- Crear route group `(app)` con layout que incluya sidebar plegable + topbar responsive.
- Crear las páginas:
  - `/login` y `/registro` (formularios visuales con validación de `loginSchema` y `createUserSchema`).
  - `/dashboard`, `/agenda`, `/agenda/nueva`, `/pacientes`, `/pacientes/[id]`, `/notificaciones`, `/reportes`, `/perfil`.
- Crear `src/app/not-found.tsx` y actualizar landing/manifest shortcuts.

## Out of scope / Non-goals

- Autenticación real, sesión, `proxy.ts` o protección de rutas.
- Llamadas a la API (todos los datos son mock).
- Calendario interactivo, date-picker, gráficos, exportación real.
- Expediente clínico funcional, bitácora con versionado, consentimiento informado real.
- Tests de componentes frontend.
- No se actualizan specs del proyecto: con datos mock y sin auth no se cumple ningún requirement todavía.

## Impacto esperado

- Navegación completa entre las pantallas principales del sistema.
- Estructura clara para conectar posteriormente API, auth y datos reales.
- Validación técnica del stack Next.js 16 + Tailwind v4 + shadcn + App Router.

## Riesgos y deuda técnica

- El `Select` de `/registro` filtra `ADMIN` a propósito; cuando haya auth real debe derivarse de una constante compartida.
- `createAppointmentSchema` sigue usando `z.enum(["in_person","virtual"])` en vez del enum `AppointmentModality`.
- Sigue pendiente la deuda ESM de `packages/shared` (exports sin `.js`).
