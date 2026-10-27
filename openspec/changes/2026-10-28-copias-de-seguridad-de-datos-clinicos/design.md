# Design

## Context

La base vive en Supabase, plan gratuito: sin copias automáticas ni recuperación a un punto en el tiempo. El proyecto ya tiene migraciones versionadas y un entorno de staging propuesto en `2026-10-28-aislar-previews-de-produccion`, que sirve como destino de la prueba de restauración.

## Goals / Non-Goals

**Goals**

- Poder recuperar la base ante borrado, corrupción o migración fallida.
- Que la copia no viva en el mismo proveedor que la base (un incidente de cuenta no debe llevarse ambas).
- Saber cuánto se tarda en restaurar, con un número medido y no estimado.

**Non-Goals**

- Alta disponibilidad o conmutación automática.
- Copias cada hora: el volumen y el uso no lo justifican.

## Decisions

### 1. `pg_dump` propio en lugar de PITR gestionado

Se usa `pg_dump` en formato custom, comprimido y cifrado con `age` o `gpg`, subido a almacenamiento compatible con S3. Cuesta ~0 y no depende de una migración de plan.

**Alternativa descartada (por ahora):** plan Pro de Supabase con recuperación a un punto en el tiempo. Es superior técnicamente (RPO de minutos) pero implica un costo recurrente que debe decidir el responsable del proyecto. Queda registrada como decisión abierta en las tareas.

### 2. Programación con el mismo cron externo

Se reutiliza el programador externo que ya dispara el despacho de notificaciones, para no sumar otro proveedor ni otra credencial. La copia es un trabajo diario, no necesita granularidad de minutos.

**Alternativa descartada:** GitHub Actions programado. Funciona, pero suma un sistema y sus límites de minutos; se deja como respaldo si el cron externo deja de ser viable.

### 3. La prueba de restauración es parte del entregable

Una copia que nunca se restauró no es una copia: es una hipótesis. La tarea de restauración se ejecuta contra el entorno aislado y se mide.

## Risks / Trade-offs

- **Cifrado y pérdida de clave.** Si se pierde la clave de cifrado, las copias no sirven. Debe custodiarse fuera del repositorio y del mismo almacenamiento.
- **Costo de almacenamiento.** 30 días de copias de una base pequeña son pocos GB; el costo es marginal.
- **RPO de 24 horas.** Se acepta; queda declarado y comparado con el objetivo del proyecto.
