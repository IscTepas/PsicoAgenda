# Design

## Context

La API se despliega como una sola función de Express en Vercel. El despacho vivía en `iniciarDespachador()`, un `setInterval` que solo tiene sentido en un proceso de larga vida (desarrollo local o un hosting tipo contenedor). En serverless la invocación termina al responder, así que el temporizador no sobrevive.

Ya existe el mecanismo correcto: `POST /api/internal/despachar` con `CRON_SECRET`, y `despacharPendientes()` con reclamo optimista por `intentos`, que lo hace seguro ante ejecuciones concurrentes. Lo que falta es el disparador y la credencial en producción.

## Goals / Non-Goals

**Goals**

- Garantizar que un recordatorio vencido se entrega en ≤5 minutos.
- Que el endpoint no pueda ser accionado por terceros.
- Que un fallo del barrido no pase inadvertido.

**Non-Goals**

- Garantías de entrega del proveedor de correo o de n8n (fuera de este sistema).
- Tiempo real: se acepta una ventana de minutos.

## Decisions

### 1. Cron externo, no Vercel Cron

Vercel Cron en el plan Hobby admite como máximo una ejecución al día, insuficiente para recordatorios. Se usa un programador externo con granularidad de minutos.

**Alternativa descartada:** cron nativo de Vercel con plan Pro. Cuesta ~20 USD/mes y no aporta nada que el externo no haga para este volumen.

### 2. La credencial falla cerrado

Si `CRON_SECRET` no está definido, el middleware responde 503. Un despliegue al que se le olvidó la variable queda inoperante pero **no abierto**; el síntoma (503) es visible en el primer intento del cron.

**Alternativa descartada:** permitir la ejecución sin secreto en desarrollo. Ya se cubre con `NODE_ENV`: en desarrollo el barrido lo hace el proceso, no el endpoint.

### 3. La idempotencia vive en la base, no en el proceso

El mutex `despachando` es por instancia y no protege entre lambdas. La garantía real es el `updateMany` condicionado por `intentos`. No se añade bloqueo externo.

## Risks / Trade-offs

- **Dependencia de un tercero gratuito.** Si el programador deja de ejecutar, los avisos se acumulan. Mitigación: alerta por fallos y, opcionalmente, un cron diario de Vercel como red de seguridad.
- **Latencia de hasta 5 minutos.** Aceptable para recordatorios; no lo sería para confirmaciones inmediatas, que no dependen de este barrido.
- **Rotación del secreto con dos lados.** Un desfase produce 401 constante; queda documentado el orden.
