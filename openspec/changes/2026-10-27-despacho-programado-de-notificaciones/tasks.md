# Tasks

## 1. Contrato del disparador interno

- [ ] 1.1 Verificar el contrato de `POST /api/internal/despachar` (sin credencial → 401, credencial inválida → 401, secreto ausente → 503, correcta → 200 con `{ procesadas, vencidas }`) y verificar con tests de supertest los cuatro casos
- [ ] 1.2 Verificar que dos barridos solapados entregan cada aviso una sola vez (reclamo optimista por `intentos`) y verificar con un test de concurrencia que no hay duplicados
- [ ] 1.3 Documentar el contrato del endpoint en el README (método, ruta, cabecera, respuestas) y verificar que el ejemplo `curl` del documento devuelve 200 al ejecutarlo con el secreto real

## 2. Credencial y disparador en producción

- [ ] 2.1 Definir `CRON_SECRET` (32 bytes aleatorios) en el proyecto API y redesplegar; y verificar con `curl` que el endpoint pasa de 503 a 401 sin cabecera y a 200 con ella
- [ ] 2.2 Dar de alta el trabajo programado cada 5 minutos apuntando al endpoint con la cabecera de autorización; y verificar en los Runtime Logs que la petición aparece con la periodicidad configurada
- [ ] 2.3 Configurar además el chequeo de `GET /api/health` cada 5 minutos; y verificar que responde 200 con `database: "up"` y que el proyecto de Supabase no entra en pausa por inactividad

## 3. Señal de fallo y operación

- [ ] 3.1 Configurar la alerta por fallos consecutivos del trabajo programado; y verificar provocando una ejecución con credencial inválida que el proveedor notifica el fallo
- [ ] 3.2 Documentar la rotación de `CRON_SECRET` (orden: hosting y luego disparador) y el síntoma de un secreto desincronizado (401 constante) en el runbook; y verificar que otra persona puede rotarlo siguiendo el documento

## 4. Verificación de extremo a extremo

- [ ] 4.1 Crear una cita con recordatorio a 15 minutos y verificar que su notificación pasa de `PENDIENTE` a `ENVIADA` antes de la cita
- [ ] 4.2 Detener el trabajo programado 20 minutos, reactivarlo y verificar que los avisos acumulados salen en el siguiente barrido sin duplicarse

## Workflow follow-up

- Archivar el cambio cuando el equipo haya revisado los artefactos y la verificación de extremo a extremo esté registrada.
