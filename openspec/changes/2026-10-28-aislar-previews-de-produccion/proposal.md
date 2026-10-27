# Proposal

## Why

El hosting define el entorno como producción también en los deployments de vista previa, así que el backend de un preview arranca con la misma configuración que producción. Como la cadena de conexión está disponible en todos los entornos, **cada preview escribe en la base real**: un revisor probando un flujo puede crear, modificar o borrar datos clínicos sin darse cuenta. No hay separación entre probar y operar.

## What Changes

- Los entornos de vista previa SHALL operar sobre una base de datos aislada de la de producción.
- Las variables sensibles del backend SHALL quedar acotadas por entorno (producción, vista previa, desarrollo).
- SHALL existir un procedimiento para poblar el entorno aislado con datos sintéticos, sin datos identificables de pacientes reales.
- SHALL quedar documentado qué entorno usa qué base y cómo se promueve un cambio.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `data-hosting`: se añade el aislamiento de entornos de ejecución como requisito de la plataforma de datos.

## Impact

- Segundo proyecto de Supabase para el entorno aislado, con migraciones, permisos y disparadores de identidad.
- Configuración de variables por entorno en el hosting.
- Datos sintéticos para el entorno aislado.
- `README.md`: mapa de entornos y procedimiento de promoción.
- Sin cambios en código de aplicación.
