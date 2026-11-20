# Tasks

## 1. Diagnóstico y decisiones de retención

- [x] 1.1 Ejecutar en Supabase la consulta de tamaño por tabla (`pg_stat_user_tables` y `pg_database_size`) y registrar el resultado inicial en el change para comparar después
- [x] 1.2 Definir `RETENCION` en el servicio de mantenimiento (90/7/30 días y 12 meses) y verificar con un test unitario que los valores son los acordados

## 2. Servicio de purga

- [x] 2.1 Implementar `purgarDatosVencidos()` con un barrido por tabla y lista blanca explícita, y verificar con un test de integración que una notificación `PENDIENTE` antigua sobrevive
- [x] 2.2 Implementar el borrado por lotes (`ctid` + `FOR UPDATE SKIP LOCKED`, máximo de lotes por ejecución) y verificar con un test que dos purgas solapadas no fallan ni duplican borrados
- [x] 2.3 Implementar la expiración de solicitudes pendientes vencidas y el borrado de terminales sin cita, y verificar con un test que una solicitud con cita asociada nunca se elimina
- [x] 2.4 Incluir la limpieza de `cache_registro` reutilizando `limpiarCacheRegistroVencida()` y verificar con un test que las filas vigentes no se tocan
- [x] 2.5 Verificar con un test de integración que expedientes, citas, pagos, consentimientos, bitácoras y usuarios conservan sus filas tras la purga

## 3. Esquema y control de bloat

- [x] 3.1 Añadir a `schema.prisma` el índice de purga de `notificaciones` y el de `solicitudes_cita`, generar la migración `20261103000000_purga_datos_operativos` con `prisma migrate diff` y verificar que `prisma validate` y `prisma migrate deploy` pasan en desarrollo
- [x] 3.2 Añadir en la misma migración los parámetros de autovacuum de `notificaciones` y `cache_registro`, y verificar con `pg_class.reloptions` que quedaron aplicados
- [x] 3.3 Verificar con `EXPLAIN` que las consultas de purga usan los índices nuevos y no recorren la tabla completa

## 4. Recordatorios reemplazados

- [x] 4.1 Cambiar `cancelarRecordatorios()` para eliminar los pendientes en lugar de marcarlos `CANCELADA`, y verificar con un test que un aviso ya enviado no se elimina
- [x] 4.2 Verificar con un test de extremo a extremo que reprogramar una cita deja exactamente los recordatorios nuevos y ninguno cancelado acumulado

## 5. Endpoint de mantenimiento

- [x] 5.1 Crear `POST /api/internal/mantenimiento` con `requireCronSecret`, conectado a `purgarDatosVencidos()`, y verificar con supertest los cuatro casos: sin credencial → 401, credencial inválida → 401, secreto ausente → 503, correcta → 200 con conteos y tamaño
- [x] 5.2 Verificar con un test que la respuesta incluye las filas eliminadas por tabla y el tamaño de la base, y que el endpoint no modifica datos clínicos

## 6. Operación y runbook

- [x] 6.1 Crear `scripts/mantenimiento-bd.mjs` con `VACUUM (ANALYZE)` sobre las tablas operativas usando la conexión directa, y verificar que corre sin error y sin bloquear
- [x] 6.2 Documentar en el README la política de retención, el contrato del endpoint y la configuración de `cron-job.org` (URL, `POST`, `Authorization: Bearer $CRON_SECRET`, diario 03:30 `America/Mazatlan`, timeout 30 s, reintentos y aviso por correo), y verificar que el ejemplo `curl` documentado responde 200 con el secreto real
- [x] 6.3 Documentar el orden de rotación de `CRON_SECRET` (Vercel, GitHub y cron-job.org) y el síntoma de un secreto desincronizado (401 constante), y verificar que otra persona puede rotarlo siguiendo el documento

## 7. Verificación de extremo a extremo

- [x] 7.1 Sembrar en desarrollo notificaciones `ENVIADA`, `FALLIDA`, `CANCELADA` y `PENDIENTE` con fechas antiguas, ejecutar la purga y verificar que solo se eliminan las tres primeras
- [x] 7.2 Ejecutar la purga dos veces seguidas y verificar que la segunda no elimina nada y no falla
- [ ] 7.3 Dar de alta el job en `cron-job.org`, probarlo con la ejecución manual y verificar en los Runtime Logs que la petición llega y responde 200
- [ ] 7.4 Comparar el tamaño de la base antes y después del primer barrido en producción y registrar la diferencia en el change

## Workflow follow-up

- Archivar el cambio cuando la migración esté aplicada en producción, el job de `cron-job.org` esté corriendo y la comparación de tamaño esté registrada.
