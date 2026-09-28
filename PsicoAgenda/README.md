# PsicoAgenda

Sistema orientado a profesionistas de la psicología para la gestión integral de la práctica clínica: programación de citas, historiales clínicos psicológicos, recordatorios automáticos (WhatsApp/correo) y roles de usuario. Busca automatizar procesos, garantizar la confidencialidad y mejorar la comunicación profesional-paciente.

> Proyecto desarrollado con **spec-driven development** usando [OpenSpec](https://openspec.co). Las especificaciones actuales viven bajo `openspec/`; el documento maestro plano `psicoagenda_openspec.md` se conserva como referencia histórica.

## Alcance

**Incluye:**
- Gestión de citas y agenda digital.
- Historiales clínicos psicológicos individuales.
- Recordatorios automáticos para pacientes (WhatsApp y correo).
- Gestión de usuarios y roles (Psicólogo/a, Paciente, Sistema).
- Generación de reportes operativos exportables a PDF/Excel.

**Excluye:**
- Módulos de facturación electrónica o contabilidad.
- Videollamadas.
- Expedientes médicos interdisciplinarios.

> **Nota sobre RD-14:** el sistema sí registra el *estado de pago de honorarios* (pendiente/pagado) como control administrativo del consultorio, pero esto no equivale a un módulo de facturación electrónica.

**Plataformas:** Aplicación multiplataforma compatible con Windows, Android y cualquier navegador moderno.

## Contenido del repositorio

| Ruta | Descripción |
|------|-------------|
| `openspec/` | Fuente de verdad: especificaciones formales de OpenSpec |
| `openspec/project.md` | Contexto del proyecto (visión, alcance, actores, RNF, RD) |
| `openspec/specs/` | Capacidades del sistema en formato OpenSpec (`spec.md`) |
| `openspec/changes/` | Cambios propuestos (flujo propose → apply → archive) |
| `openspec/config.yaml` | Configuración de OpenSpec (schema `spec-driven`, idioma `es`) |
| `apps/api/` | Backend Express 5 + TypeScript + Prisma 7 |
| `apps/web/` | Frontend Next.js 16 + Tailwind v4 + shadcn/ui + PWA Serwist |
| `packages/shared/` | Tipos, esquemas Zod y constantes compartidas |
| `.opencode/` | Slash commands y skills de OpenSpec para opencode |
| `psicoagenda_openspec.md` | Documento maestro original (referencia histórica) |
| `README.md` | Este archivo |

### Capacidades actuales (`openspec/specs/`)

| Capacidad | Descripción | Requirements |
|-----------|-------------|--------------|
| `user-management` | Registro, autenticación (2FA), roles, perfiles, tutores legales | 5 |
| `appointment-management` | Agenda: programar, modificar, cancelar, disponibilidad, asistencia | 5 |
| `notification-management` | Recordatorios 24 h, confirmación asistencia, notificaciones de cambio | 3 |
| `medical-record` | Historial clínico, bitácora por sesión, consentimiento, contacto de emergencia | 7 |
| `reporting` | Reportes estadísticos de citas exportables a PDF/Excel | 2 |
| `data-protection` | Cifrado, 2FA, sesiones, LFPDPPP, respaldo AWS, retención y portabilidad | 8 |
| **Total** | | **30** |

## Requisitos previos

- **Node.js** ≥ 20.19.0 y **npm** ≥ 9.
- **PostgreSQL** 15+ (solo para ejecutar migraciones; `prisma generate` y `prisma validate` no lo requieren).
- **OpenSpec CLI** instalado globalmente:

```bash
npm install -g @fission-ai/openspec
openspec --version
```

## Estructura del monorepo

```text
PsicoAgenda/
├── apps/
│   ├── api/    # Backend Express 5 + Prisma 7
│   └── web/    # Frontend Next.js 16 + PWA
├── packages/
│   └── shared/ # Tipos, schemas y constantes compartidas
├── openspec/   # Especificaciones del proyecto
└── package.json # Workspaces de npm
```

## Cómo inicializar el proyecto

### 1. Clonar el repositorio

```bash
git clone <url-del-repo> PsicoAgenda
cd PsicoAgenda
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Ajusta `DATABASE_URL` en `apps/api/.env` con tus credenciales de PostgreSQL.

### 4. Generar el cliente de Prisma

```bash
npm run prisma:generate
```

### 5. Ejecutar migraciones (requiere PostgreSQL)

```bash
npm run prisma:migrate
```

> Por ahora la base de datos se deja vacía; el seed es un placeholder. Los datos de ejemplo se agregarán en changes posteriores.

### 6. Levantar en desarrollo

```bash
# Ambas aplicaciones a la vez
npm run dev

# O por separado
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

### 7. Verificar la estructura

```bash
# Lista las capacidades y su número de requirements
openspec list --specs

# Estado de salud del root de OpenSpec
openspec doctor

# Contexto de trabajo del proyecto
openspec context
```

### 8. Validar las especificaciones

```bash
openspec validate --specs
```

Debe devolver: `6 passed, 0 failed`.

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Levanta API y web en paralelo |
| `npm run dev:api` | Levanta solo el backend |
| `npm run dev:web` | Levanta solo el frontend |
| `npm run typecheck` | Typecheck de todo el monorepo |
| `npm run lint` | Lint de API y web |
| `npm test` | Tests del backend |
| `npm run build` | Build completo (shared → api → web + service worker) |
| `npm run prisma:generate` | Genera el cliente de Prisma 7 |
| `npm run prisma:migrate` | Ejecuta migraciones con PostgreSQL |

## Flujo de trabajo con OpenSpec

El desarrollo se gestiona con cambios propuestos antes de tocar código:

1. **Propose** — crear una propuesta de cambio:

```bash
openspec new change <nombre-del-cambio>
```

   o desde `opencode` con el slash command `/opsx-propose`.

2. **Spec** — rellenar `proposal.md`, `tasks.md`, `design.md` y los `specs/` delta del cambio.
3. **Validate** — `openspec validate <nombre-del-cambio>`.
4. **Apply** — implementar el código conforme a la especificación (`/opsx-apply`).
5. **Archive** — al terminar, archivar el cambio para integrar sus deltas en `openspec/specs/` (`/opsx-archive`).

## Requisitos clave (resumen)

- **Rendimiento:** operaciones < 3 s.
- **Escalabilidad:** mínimo 500 pacientes y 1000 citas.
- **Seguridad:** cifrado en tránsito/reposo, contraseñas cifradas, 2FA, control de sesiones.
- **Disponibilidad:** 99% en horario laboral.
- **Privacidad:** cumplimiento de la Ley Federal de Protección de Datos Personales (México).
- **Infraestructura:** respaldo en AWS.
- **Dominio:** citas de 45–60 min, tutores legales para menores, código ético APA, contacto de emergencia obligatorio, retención y portabilidad de datos.
