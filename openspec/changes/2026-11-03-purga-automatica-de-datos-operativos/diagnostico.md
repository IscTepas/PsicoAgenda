# Diagnóstico inicial de tamaño (1.1)

**Fecha:** 2026-11-11
**Proyecto Supabase:** `fjmgypvqbvngycvrdptj` (el de desarrollo/pruebas; el `.env`
local apunta a su pooler). No hay credenciales de producción en el repositorio,
así que la comparación antes/después en producción queda para el paso 7.4.

## Consulta

```sql
SELECT current_database() AS db,
       pg_size_pretty(pg_database_size(current_database())) AS tamano;

SELECT relname, n_live_tup, n_dead_tup,
       pg_size_pretty(pg_total_relation_size(relid)) AS total
  FROM pg_stat_user_tables
 ORDER BY pg_total_relation_size(relid) DESC;
```

## Resultado inicial (antes de la primera purga)

| Tabla | Filas vivas | Tuplas muertas | Tamaño total |
|---|---:|---:|---:|
| `usuarios` | 10 | 52 | 344 kB |
| `notificaciones` | 91 | 29 | 224 kB |
| `citas` | 8 | 47 | 144 kB |
| `solicitudes_cita` | 51 | 12 | 96 kB |
| `pagos_honorarios` | 7 | 51 | 88 kB |
| `entradas_bitacora` | 2 | 1 | 80 kB |
| `motivos_consulta` | 26 | 20 | 64 kB |

Tamaño lógico de la base: **14 MB**.

## Lectura

- Las tablas operativas que ataca la purga son `notificaciones` (91 vivas, 29
  muertas) y `solicitudes_cita` (51 vivas, 12 muertas). `cache_registro` no
  aparecía entre las mayores: es efímera por diseño.
- Las tablas clínicas y de negocio son pequeñas y no muestran el patrón de
  actualización repetida de `notificaciones`; confirma que la lista blanca del
  servicio deja fuera lo que no debe tocarse.
- A esta escala el tamaño lógico no cambia de forma perceptible: la métrica útil
  es la reutilización de espacio y las tuplas muertas, no el archivo en disco.

## Después del primer barrido (desarrollo)

Tras ejecutar la purga y el `VACUUM (ANALYZE)` mensual:

| Tabla | Filas vivas | Tuplas muertas | Tamaño total |
|---|---:|---:|---:|
| `notificaciones` | 94 | 0 | 320 kB |
| `solicitudes_cita` | 51 | 0 | 120 kB |
| `cache_registro` | 0 | 0 | 56 kB |

La base sigue en **14 MB**: `VACUUM` reutiliza espacio pero no achica el archivo
(no se usa `VACUUM FULL` porque bloquea la tabla). Lo verificable es que las
tuplas muertas de las tablas operativas quedaron en 0 y que el autovacuum de
`notificaciones` y `cache_registro` tiene umbrales propios (2 % / 50 filas).
