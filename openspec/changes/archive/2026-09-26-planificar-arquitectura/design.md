# Diseño — 2026-09-26 Planificar arquitectura del monorepo PsicoAgenda

## Estructura del monorepo

```text
PsicoAgenda/
├── apps/
│   ├── api/                      # Backend Express (ESM)
│   │   ├── src/
│   │   │   ├── config/           # Variables de entorno
│   │   │   ├── controllers/      # Controladores de rutas
│   │   │   ├── generated/        # Cliente Prisma generado (no versionar)
│   │   │   ├── lib/              # Cliente Prisma y utilidades compartidas
│   │   │   ├── middleware/       # Auth, validación (Zod) y errores
│   │   │   ├── routes/           # Definición de endpoints
│   │   │   ├── services/         # Lógica de negocio
│   │   │   ├── types/            # Tipos auxiliares (AuthedRequest)
│   │   │   ├── utils/            # AppError, helpers JWT
│   │   │   ├── app.ts            # Configuración de Express
│   │   │   └── index.ts          # Punto de entrada
│   │   ├── prisma/
│   │   │   ├── prisma.config.ts  # Configuración de Prisma 7
│   │   │   ├── schema.prisma     # Esquema completo del dominio
│   │   │   └── seed.ts           # Seed inicial (placeholder)
│   │   ├── tests/                # Tests con Vitest + Supertest
│   │   ├── eslint.config.mjs     # Flat config ESLint 9 + typescript-eslint
│   │   ├── vitest.config.ts      # Configuración de tests
│   │   ├── tsconfig.json         # Referencia a packages/shared
│   │   ├── tsconfig.node.json    # Tooling y tests
│   │   ├── .env.example
│   │   └── package.json
│   └── web/                      # Frontend Next.js 16
│       ├── src/
│       │   ├── app/              # App Router (páginas, manifest, SW)
│       │   │   ├── manifest.ts   # Manifest PWA nativo de Next.js
│       │   │   ├── sw.ts         # Service worker de Serwist
│       │   │   ├── serwist.ts    # Re-export de SerwistProvider
│       │   │   ├── offline/
│       │   │   ├── globals.css   # Tailwind v4 + tokens de shadcn
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx      # Landing de PsicoAgenda
│       │   ├── components/       # Componentes React (shadcn + custom)
│       │   ├── hooks/            # Custom hooks (useApiHealth)
│       │   ├── lib/              # Utilidades y api-client (fetch)
│       │   └── services/         # Clientes HTTP hacia la API
│       ├── public/
│       │   └── icons/            # Iconos SVG del PWA
│       ├── serwist.config.mjs    # Configuración del modo configurator
│       ├── tsconfig.json         # Excluye sw.ts (tiene su propio tsconfig)
│       ├── tsconfig.sw.json      # Typecheck del service worker
│       ├── components.json       # shadcn/ui
│       └── package.json
├── packages/
│   └── shared/                   # Código compartido entre apps
│       ├── src/
│       │   ├── types/            # Tipos y enums compartidos
│       │   ├── schemas/          # Esquemas Zod compartidos
│       │   └── constants/        # Constantes comunes
│       ├── package.json          # Exports ESM
│       └── tsconfig.json
├── openspec/                     # Especificaciones del proyecto
├── tsconfig.base.json            # CompilerOptions compartidos
├── tsconfig.json                 # TypeScript solution file
├── package.json                  # Root con workspaces
└── README.md
```

## Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | Next.js 16 (App Router) | Bundler Turbopack por defecto, SSR/SSG, layouts anidados y soporte nativo de PWA (`manifest.ts`). |
| Estilos | Tailwind CSS v4 + shadcn/ui | Utilidades con CSS-first config, componentes accesibles basados en Radix. |
| Formularios | React Hook Form + Zod | Validación tipada y rendimiento en formularios. |
| Cliente HTTP | TanStack Query + fetch | Manejo de estado de servidor, caché y reintentos; `fetch` nativo sin dependencias extra. |
| Backend | Express.js 5 + TypeScript | Framework maduro, soporte nativo de ESM y middleware async robusto. |
| Base de datos | PostgreSQL + Prisma 7 | ORM Rust-free, driver adapters obligatorios, salida de cliente tipada en `src/generated`. |
| Autenticación | JWT + bcrypt | Estado del arte para APIs REST sin sesión en servidor. |
| Notificaciones | WhatsApp Business API + Nodemailer | Canales definidos en el ERS para recordatorios. |
| PWA | Serwist (modo configurator) | Compatible con Turbopack; precache de rutas prerenderizadas. |
| Monorepo | npm workspaces + TS project references | Compatible con el entorno y builds ordenados (shared → api). |

## Configuración PWA

El frontend se configura como Progressive Web App para permitir:
- Instalación en Android y Windows.
- Icono en el escritorio/inicio.
- Funcionamiento offline básico (service worker).
- Push notifications en el futuro.

Archivos clave:
- `src/app/manifest.ts`: manifest en formato nativo de Next.js 16.
- `serwist.config.mjs`: configuración del modo configurator de Serwist.
- `src/app/sw.ts`: service worker con `defaultCache` y fallback a `/offline`.
- `public/icons/`: iconos SVG del PWA (en producción se recomienda exportar PNG de 192 y 512 px).

En desarrollo el service worker no se compila ni se registra; solo se activa en `NODE_ENV=production`.

## Comunicación front-back

```text
┌─────────────┐      HTTP/REST       ┌─────────────┐   Prisma 7 + pg   ┌─────────────┐
│  Next.js    │ ◄──────────────────► │   Express   │ ◄───────────────► │  PostgreSQL │
│   (PWA)     │    JSON + JWT        │    (API)    │   adapter         │             │
└─────────────┘                      └─────────────┘                   └─────────────┘
```

- El frontend consume la API REST en `http://localhost:4000` (configurable vía `NEXT_PUBLIC_API_URL`).
- La autenticación usa JWT Bearer token.
- Validaciones compartidas vía `packages/shared` usando Zod.

## Convenciones

- Todo el código en TypeScript.
- Uso de `kebab-case` para nombres de archivos.
- `apps/api` es un proyecto ESM (`"type": "module"`) con aliases `@/*` resueltos en build por `tsc-alias`.
- `packages/shared` expone ESM puro con `exports` en `package.json`.
- Variables de entorno en archivos `.env.example` (sin secretos comiteados).
- Commits con descripción clara del cambio.

## Decisiones tomadas

1. **Prisma 7 en vez de Prisma 6**: cliente Rust-free, ESM nativo, requiere `prisma.config.ts`, driver adapter `@prisma/adapter-pg` y `output` en el generador.
2. **Next.js 16 + Turbopack**: se mantiene la versión instalada por `create-next-app`; el PWA usa Serwist en modo configurator para no depender de webpack.
3. **ESM en `apps/api`**: `"type": "module"`, imports con aliases `@/*` reescritos a rutas relativas con extensión `.js` por `tsc-alias` para que `node dist/index.js` funcione.
4. **Project references de TypeScript**: el root `tsconfig.json` es un *solution file* que referencia `packages/shared` y `apps/api`, asegurando el orden de build correcto.
5. **Dominio completo en Prisma**: el `schema.prisma` cubre User, Psychologist, Patient, Appointment, ClinicalRecord, LogEntry, InformedConsent, Notification, Report, HonorariumPayment y tipos auxiliares (TwoFactorAuth, EmergencyContact, LegalGuardian).

## Decisiones diferidas

- Migraciones definitivas: `prisma migrate dev` se ejecutará cuando exista un entorno PostgreSQL disponible.
- Despliegue: se definirá en un change posterior (Vercel, Railway, AWS, etc.).
- Integración real con WhatsApp Business API y correo: solo se preparó el stack.
