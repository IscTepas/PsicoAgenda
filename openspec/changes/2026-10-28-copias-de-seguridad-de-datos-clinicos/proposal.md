# Proposal

## Why

El plan gratuito de Supabase no incluye copias automáticas ni recuperación a un punto en el tiempo, y la base contiene historias clínicas, notas de sesión y datos de contacto: información sensible según la Ley Federal de Protección de Datos Personales. Hoy la única protección es que la base no falle: un borrado accidental, una migración mal aplicada o una corrupción no tienen vuelta atrás.

## What Changes

- El sistema SHALL producir una copia diaria de la base, cifrada, conservada fuera del proveedor de la base de datos.
- SHALL existir una retención definida (mínimo 30 días) y una copia mensual de mayor plazo.
- SHALL existir un procedimiento de restauración **probado**, no solo documentado, con RPO y RTO declarados.
- SHALL existir una alerta cuando la copia falla o no aparece en 24 horas.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `data-protection`: el requisito «Respaldo en AWS» pasa de una copia periódica sin verificación a una copia diaria, cifrada, retenida y con restauración comprobada; se retira la dependencia explícita de un proveedor concreto.

## Impact

- Nuevo script de copia (fuera de `apps/`, en `scripts/` o similar) y su programación.
- Almacenamiento externo compatible con S3 y una credencial de solo escritura.
- `README.md` / runbook de restauración.
- Posible decisión de plan: copia propia sobre el plan gratuito o plan Pro con recuperación a un punto en el tiempo.
- Sin cambios en código de aplicación ni en el esquema.
