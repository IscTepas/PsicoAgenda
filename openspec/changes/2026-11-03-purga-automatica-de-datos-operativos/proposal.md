# Proposal

## Why

La base crece por datos operativos, no por historia clínica: `notificaciones` es la tabla de mayor rotación porque cada evento genera una fila por canal y por destinatario (confirmación, recordatorio de 24 h y de 2 h, copias para tutores) y porque cada fila se actualiza varias veces (crear, reclamar intento, marcar enviada, estado de entrega de WhatsApp), lo que deja tuplas muertas. Además, cada reprogramación conserva como `CANCELADA` los recordatorios que reemplaza. `solicitudes_cita` acumula solicitudes rechazadas, canceladas y pendientes con fecha ya vencida que nadie atiende. `cache_registro` solo se limpia cuando el barrido se ejecuta.

Nada de eso se elimina hoy. El resultado es una base que crece de forma indefinida, con respaldos más lentos y mayor consumo del plan de Supabase, sin que exista un criterio documentado de cuánto tiempo se conserva cada cosa.

## What Changes

- El sistema SHALL purgar automáticamente las notificaciones `ENVIADA` y `FALLIDA` con más de 90 días, y las `CANCELADA` con más de 7 días.
- El sistema SHALL NOT purgar notificaciones `PENDIENTE`, sin importar su antigüedad.
- El sistema SHALL marcar `CANCELADA` las solicitudes de cita pendientes con fecha vencida hace más de 30 días, y eliminar las terminales sin cita con más de 12 meses.
- El sistema SHALL eliminar las entradas vencidas de `cache_registro` en cada purga.
- El sistema SHALL NOT eliminar automáticamente expedientes clínicos, citas, pagos, consentimientos, entradas de bitácora, tutores ni usuarios.
- SHALL existir un disparador interno autenticado (`POST /api/internal/mantenimiento`) que ejecute la purga por lotes, de forma idempotente, e informe filas eliminadas y tamaño de la base.
- Los recordatorios pendientes de una cita SHALL eliminarse cuando esta se reprograma, cancela o registra asistencia, en lugar de conservarse como avisos cancelados.
- SHALL existir una migración con índices de apoyo y parámetros de autovacuum para las tablas de alta rotación, más un mantenimiento periódico de `VACUUM ANALYZE`.
- SHALL quedar documentada la política de retención y la configuración del disparador externo.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `data-protection`: se añade la retención de datos operativos y el control de crecimiento de la base, sin alterar la retención de expedientes clínicos.
- `notification-management`: se define el ciclo de vida de los avisos, incluida la eliminación de recordatorios reemplazados al reprogramar o cancelar una cita.

## Impact

- `apps/api/src/services/mantenimiento.service.ts` (nuevo), `apps/api/src/routes/internal.routes.ts`, `apps/api/src/services/notification.service.ts`.
- `apps/api/prisma/migrations/20261103000000_purga_datos_operativos/migration.sql` (índices y autovacuum).
- `scripts/mantenimiento-bd.mjs` (nuevo, `VACUUM ANALYZE`).
- `README.md`, sección de despliegue y operación.
- Variables de entorno: reutiliza `CRON_SECRET`; sin variables nuevas obligatorias.
- Sin cambios en el contrato público de la API de negocio ni en el esquema de datos clínicos.
