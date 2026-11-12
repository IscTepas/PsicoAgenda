# Design

## Context

Ver `proposal.md` — Why.

La API corre como una función de Express en Vercel. Ya existe el patrón de tareas internas: `POST /api/internal/*` protegido por `requireCronSecret` en `apps/api/src/middleware/cron.middleware.ts`, disparado por un cron externo, e idempotente por diseño. `despacharPendientes()` ya purga la cache vencida de forma oportunista, pero no existe ninguna política de retención para el resto de datos operativos.

El esquema distingue con claridad dos mundos: datos clínicos y de negocio (`expedientes_clinicos`, `citas`, `pagos_honorarios`, `consentimientos_informados`, `entradas_bitacora`) y datos operativos (`notificaciones`, `cache_registro`, `solicitudes_cita`). Solo el segundo puede purgarse automáticamente. `expedientes_clinicos.conservar_hasta` y el trigger de baja que anonimiza en lugar de borrar confirman que la retención clínica es una decisión legal, no técnica.

El proyecto aplica migraciones con `migrate diff` + `migrate deploy`, sin base sombra, y acepta objetos escritos a mano en la migración cuando Prisma no los modela (índices parciales, `CHECK`, funciones). El respaldo diario corre por GitHub Actions con `pg_dump` sobre una conexión directa (`BACKUP_DATABASE_URL`).

## Goals / Non-Goals

**Goals:**

- Detener el crecimiento indefinido de las tablas operativas con una política explícita y documentada.
- Que la purga sea segura: nunca toca datos clínicos ni avisos pendientes.
- Que el espacio se reutilice y las estadísticas se mantengan al día (bloat controlado).
- Que el operador pueda ver el efecto: filas eliminadas y tamaño de la base en cada ejecución.

**Non-Goals:**

- Borrar expedientes, citas, pagos, consentimientos ni bitácoras.
- Purgar archivos de Supabase Storage (documentos y reportes).
- Implementar retención configurable sin despliegue; las ventanas viven como constantes del servicio.
- Sustituir el respaldo diario existente.

## Decisions

### 1. Endpoint HTTP con `CRON_SECRET`, no `pg_cron`

Se reutiliza el patrón ya probado de `/api/internal/despachar`: una ruta interna autenticada, disparada por un cron externo. El secreto ya existe, el middleware ya falla cerrado y la operación queda visible en los Runtime Logs.

**Alternativa descartada:** `pg_cron` de Supabase. Ejecutaría SQL sin HTTP, pero añade una segunda superficie de credenciales y deja el mantenimiento fuera del código versionado y de las pruebas.

**Alternativa descartada:** un job nuevo en GitHub Actions. Funcionaría, pero separa la purga del despacho y obliga a compartir el mismo workflow; el usuario pidió `cron-job.org` para esta tarea.

### 2. Lista blanca de tablas, nunca borrado genérico por fecha

La purga enumera explícitamente qué tablas toca. No existe una regla del tipo «borrar todo lo anterior a N meses»: una regla genérica es exactamente el error que podría destruir historia clínica.

### 3. Borrado por lotes con `ctid` y `FOR UPDATE SKIP LOCKED`

El endpoint debe terminar muy por debajo de los 30 s de `cron-job.org` y del límite de la función en Vercel. Cada barrido borra como máximo un número acotado de filas por tabla (lote de 1 000, hasta 10 lotes). Si queda trabajo, la siguiente ejecución continúa. `SKIP LOCKED` evita que dos ejecuciones solapadas se bloqueen entre sí; el borrado es idempotente porque la condición es por fecha.

El filtro de estado se escribe con literales del enum (`'ENVIADA'::estado_envio`, `'FALLIDA'::estado_envio`, `'CANCELADA'::estado_envio`) en SQL crudo: evita el casting de arreglos de enums de Prisma y, a diferencia de `estado::text`, permite que el planificador use el índice `(estado, creado_en)`. Las constantes de estado del código siguen viniendo de `@/generated/prisma/enums`.

### 4. `PENDIENTE` es intocable

Un recordatorio pendiente puede tener días de antigüedad y seguir siendo válido (cita futura reprogramada). La purga filtra por estado además de por fecha, y las pruebas verifican que una notificación `PENDIENTE` antigua sobrevive.

### 5. Los recordatorios reemplazados se borran, no se marcan

`cancelarRecordatorios()` actualmente hace `updateMany ... estado = CANCELADA`. Eso conserva filas que ya no le sirven a nadie y genera tuplas muertas en cada reprogramación. Pasa a `deleteMany` sobre los pendientes de esa cita. Un aviso ya enviado no cumple la condición y no se toca.

### 6. Autovacuum por tabla y `VACUUM ANALYZE` mensual

Las tablas de alta rotación necesitan umbrales más agresivos que el valor global. La migración ajusta `autovacuum_vacuum_scale_factor` y `autovacuum_vacuum_threshold` en `notificaciones` y `cache_registro`. El `VACUUM (ANALYZE)` no puede ejecutarse dentro de una petición HTTP ni de la transacción implícita de Prisma, así que va en `scripts/mantenimiento-bd.mjs`, que usa la conexión directa (`BACKUP_DATABASE_URL`) y se corre a mano una vez al mes.

### 7. Ventanas de retención como constantes del servicio

`RETENCION = { notificacionesEnviadasDias: 90, notificacionesCanceladasDias: 7, solicitudesVencidasDias: 30, solicitudesTerminalesMeses: 12 }`. Menos superficie de configuración y pruebas más simples. Si más adelante hace falta ajustar sin desplegar, se migra a variables de entorno con estos mismos valores por defecto.

### 8. Diagnóstico antes de decidir

El endpoint devuelve, además de los conteos, `pg_database_size(current_database())`. La primera ejecución en producción se hace después de correr la consulta de diagnóstico por tabla, para confirmar que las ventanas elegidas atacan la tabla que realmente pesa.

## Risks / Trade-offs

- **Pérdida de historial de avisos** → la campana solo muestra las últimas 50 notificaciones `SISTEMA` enviadas; 90 días cubren de sobra ese caso de uso. Si se necesitara auditoría de entrega a largo plazo, habría que subir la ventana o exportar antes de purgar.
- **El espacio no se devuelve al sistema operativo de inmediato** → `VACUUM` normal reutiliza espacio dentro de Postgres; no achica el archivo. No se usa `VACUUM FULL` porque bloquea la tabla. La métrica relevante es el tamaño lógico y la reutilización, no el archivo en disco.
- **Dependencia de un tercer proveedor** → si `cron-job.org` deja de ejecutar, no se pierde nada: los datos se acumulan y se purgan en la siguiente ejecución correcta.
- **Borrado accidental de una tabla clínica** → se mitiga con lista blanca explícita y pruebas de integración que verifican que esas tablas conservan sus filas.
- **Ejecución solapada** → se mitiga con lotes, `SKIP LOCKED` e idempotencia por fecha; no se necesita un mutex de proceso.
- **Timeout del disparador** → lotes acotados y tope de lotes por ejecución; el trabajo restante espera a la siguiente corrida.

## Migration Plan

1. Añadir los índices a `schema.prisma`, generar la migración con `prisma migrate diff` y completarla a mano con los `ALTER TABLE ... SET (...)` de autovacuum.
2. Aplicar con `prisma migrate deploy` + `grants.sql` en desarrollo y verificar con `openspec`/`prisma validate` que no hay desviación.
3. Desplegar la API con el endpoint nuevo; verificar `401` sin credencial y `503` si falta el secreto.
4. Ejecutar la purga una vez a mano con `curl` y comparar el tamaño antes/después.
5. Dar de alta el job diario en `cron-job.org`, probarlo y habilitarlo.
6. **Rollback:** el endpoint es aditivo; deshabilitar el job en `cron-job.org` detiene toda purga sin tocar el despliegue. Los índices y parámetros de autovacuum se pueden revertir con una migración inversa si causaran un problema de rendimiento.

## Open Questions

(ninguna)
