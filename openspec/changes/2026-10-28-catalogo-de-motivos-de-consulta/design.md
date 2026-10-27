# Design

## Context

`citas.motivo` y `solicitudes_cita.motivo` son `String?`. El motivo llega del formulario como texto libre (`input.reason` en la API) y se muestra en el detalle de la cita. No hay tabla de referencia ni valores canónicos.

Las migraciones del proyecto son escritas y aplicadas con `migrate diff` + `migrate deploy`; la baseline incluye objetos que Prisma no modela, así que no se usa `migrate dev`.

## Goals / Non-Goals

**Goals**

- Un dato comparable: «cuántas consultas por ansiedad este mes» debe ser una consulta, no una revisión manual.
- Que el psicólogo elija en dos toques, sin escribir.
- No perder ningún motivo histórico ni romper reportes existentes.

**Non-Goals**

- Diagnóstico ni clasificación clínica (CIE/DSM). El motivo es el motivo declarado, no un diagnóstico.
- Reportes por motivo: se habilitan, pero se diseñan aparte.

## Decisions

### 1. Catálogo global, no por psicólogo

Un catálogo por profesional reproduce el problema que se quiere resolver: cada uno crea sus etiquetas y vuelve el texto libre con pasos extra.

**Trade-off:** un profesional con una especialidad rara tiene que pedir un motivo nuevo. Se mitiga con «Otro» y con un catálogo amplio en la carga inicial.

### 2. Dos niveles: categoría y motivo

`categoria` como texto controlado (o tabla propia si crece) y `etiqueta` como el motivo concreto. Permite agrupar («Ansiedad», «Estado de ánimo», «Vinculares») sin explotar el número de filas.

**Alternativa descartada:** catálogo plano. Más simple, pero los reportes por categoría son el caso de uso principal.

### 3. `motivo_id` nullable y conservar el texto

La cita guarda `motivo_id` y sigue guardando `motivo` como texto: para «Otro» y para todo lo histórico, que no se reescribe. La lectura muestra la etiqueta del catálogo cuando existe y el texto cuando no.

**Alternativa descartada:** migrar el texto histórico a ids por coincidencia difusa. Riesgo alto de clasificar mal datos clínicos; no se toca.

### 4. «Otro» es una fila del catálogo

Se modela con `es_otro = true` y `requiere_texto = true`, no como una constante del código. Así la UI, la validación y el reporte tratan todos los casos igual, y el texto obligatorio es una regla de datos.

### 5. Borrado prohibido, desactivación permitida

Los motivos en uso no se pueden eliminar (`onDelete: Restrict`). Desactivar (`activo = false`) los saca del selector sin romper la historia.

## Risks / Trade-offs

- **Catálogo inicial incompleto.** Se resuelve con una carga inicial amplia y «Otro»; el catálogo se ajusta con el uso.
- **Dos fuentes de verdad** (`motivo_id` y `motivo`). Se acota con una regla explícita: si hay `motivo_id`, el texto solo se usa cuando la fila es «Otro». La validación de la API lo impone.
- **Pantalla de administración.** Es trabajo nuevo; si se pospone, el catálogo se gestiona por migración/seed y el change pierde autonomía. Se incluye un CRUD mínimo.
