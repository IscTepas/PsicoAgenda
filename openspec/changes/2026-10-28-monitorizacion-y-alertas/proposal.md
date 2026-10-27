# Proposal

## Why

El backend expone `GET /api/health`, que consulta la base y responde 503 cuando no puede alcanzarla, pero nadie lo consulta: hoy una caída se descubre cuando un paciente no puede entrar o un psicólogo no ve su agenda. Tampoco hay registro de disponibilidad ni de latencia, así que no se puede afirmar si se cumple el requisito de operaciones en menos de 3 segundos.

## What Changes

- SHALL existir un chequeo periódico de salud ejecutado desde fuera del hosting.
- SHALL existir una alerta ante fallos sostenidos, sin alertar por un fallo aislado.
- SHALL distinguirse en la alerta entre caída de la API y caída de la base de datos.
- SHALL registrarse disponibilidad y latencia, comparables contra el umbral declarado.
- SHALL existir un procedimiento documentado de qué revisar ante cada alerta.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `data-hosting`: se añade la observabilidad de disponibilidad y las alertas como requisito de operación de la plataforma.

## Impact

- Configuración del monitor externo y de sus alertas.
- `README.md` / runbook de incidentes.
- Sin cambios en código: el endpoint de salud ya existe y ya distingue el estado de la base.
- Opcional y fuera de alcance: seguimiento de errores de aplicación con un servicio dedicado.
