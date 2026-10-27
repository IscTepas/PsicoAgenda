# Design

## Context

`GET /api/health` ya ejecuta `SELECT 1` contra la base y devuelve `{ status, database, timestamp }`, con 503 cuando la base no responde. No requiere autenticación y no tiene efectos secundarios, así que sirve como sonda externa tal cual. Lo que falta es quien la consulte y quién avise.

## Goals / Non-Goals

**Goals**

- Enterarse de una caída antes que un usuario.
- Distinguir «la API no responde» de «la API responde, la base no».
- Tener una cifra de disponibilidad y latencia para comparar con el requisito de rendimiento.

**Non-Goals**

- Observabilidad de negocio (cuántas citas se crean, etc.).
- Trazas distribuidas o seguimiento de errores de aplicación.

## Decisions

### 1. Reutilizar el monitor externo, no añadir otro proveedor

El mismo servicio que dispara el despacho puede consultar la salud cada 5 minutos. Suma menos credenciales y menos superficies.

**Alternativa descartada:** monitor dedicado con más funciones. Se puede adoptar después sin cambiar el contrato: el endpoint ya expone lo necesario.

### 2. Umbral de fallos consecutivos, no alerta inmediata

Se alerta tras dos fallos consecutivos (≈10 minutos). Un despliegue normal provoca un fallo momentáneo; alertar al primero entrena al equipo a ignorar las alertas.

**Trade-off:** 10 minutos de ceguera real en el peor caso. Aceptable frente al ruido.

### 3. La alerta dice qué falló

El cuerpo de `/api/health` ya incluye `database`. El mensaje de alerta se construye con ese dato para que quien reciba el aviso sepa si reiniciar el servicio o mirar la base.

### 4. Sin dependencia nueva en el código

No se añade instrumentación: la sonda externa y los registros del hosting bastan para el objetivo planteado.

## Risks / Trade-offs

- **El monitor vive fuera del hosting.** Si el proveedor del monitor falla, no hay alertas de nada. Mitigación: revisar periódicamente que el monitor sigue ejecutando.
- **Datos de disponibilidad de terceros.** No son auditables al 100 %; son una señal operativa, no un SLA contractual.
- **Ruido por mantenimientos.** Debe existir una forma de silenciar alertas durante una ventana de mantenimiento; se documenta en el runbook.
