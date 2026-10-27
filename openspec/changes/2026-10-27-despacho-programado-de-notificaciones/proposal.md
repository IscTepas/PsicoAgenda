# Proposal

## Why

El despacho de avisos depende hoy de un proceso que vive entre peticiones: un `setInterval` de 60 segundos. En el hosting actual (serverless) ese proceso no existe, así que el barrido lo dispara un cron externo contra `POST /api/internal/despachar`. Ese disparador no está configurado y la credencial tampoco: el endpoint responde 503 y los recordatorios programados se acumulan en `PENDIENTE` sin llegar al paciente. El riesgo no es perder datos —las filas esperan— sino la inasistencia que los recordatorios debían evitar.

## What Changes

- El barrido SHALL ejecutarse con una frecuencia acotada (máximo 5 minutos) y SHALL NOT depender de que haya tráfico de usuarios.
- El endpoint interno SHALL exigir una credencial (`Authorization: Bearer`) y SHALL fallar cerrado (503) cuando el secreto no esté configurado.
- El despacho SHALL seguir siendo idempotente ante ejecuciones solapadas.
- SHALL existir una señal de fallo sostenido (alerta), no solo registros en el log.
- SHALL quedar documentada la rotación del secreto entre el hosting y el disparador.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `notification-management`: se añade la garantía de despacho programado independiente del tráfico y la autenticación del disparador interno.

## Impact

- `apps/api/src/routes/internal.routes.ts`, `apps/api/src/middleware/cron.middleware.ts`, `apps/api/src/services/notification.service.ts`.
- Variables de entorno del proyecto API (`CRON_SECRET`) y configuración del proveedor de cron.
- `README.md`, sección Despliegue.
- Sin cambios de esquema ni del contrato público de la API de negocio.
