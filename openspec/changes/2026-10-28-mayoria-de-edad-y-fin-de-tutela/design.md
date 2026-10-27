# Design

## Context

La tutoría se modela en `pacientes_tutores` (cambio anterior). La autorización por vínculo resuelve si un usuario puede operar sobre un paciente. Nada de eso conoce la edad como condición de vigencia: `pacientes.fecha_nacimiento` es opcional y hoy solo se usa en el registro para exigir tutor.

Existe un disparador programado que ya ejecuta el despacho de notificaciones, reutilizable para un barrido diario.

## Goals / Non-Goals

**Goals**

- Que el acceso del tutor termine el día que corresponde, sin depender de una persona.
- Que el consentimiento quede en manos de quien puede otorgarlo.
- Que un fallo del barrido no deje permisos abiertos.

**Non-Goals**

- Tutela de personas mayores con incapacidad declarada (requiere otro marco legal y otro modelo).
- Bloquear la agenda del paciente hasta que firme el consentimiento nuevo.

## Decisions

### 1. Doble defensa: regla al autorizar y barrido de limpieza

La autorización comprueba la edad en cada petición; si el paciente ya cumplió 18, el vínculo no autoriza aunque la fila siga en la base. El barrido diario solo materializa el cambio y notifica. Así un barrido caído no se convierte en un acceso indebido.

**Alternativa descartada:** confiar solo en el barrido. Un fallo del cron dejaría al tutor con permisos indefinidamente.

### 2. Los vínculos se eliminan; la historia queda en auditoría y en los consentimientos

Se borran las filas de `pacientes_tutores` y se registra la transición en `registros_auditoria`. Los consentimientos firmados no se tocan: guardan `tutor_legal_id` y `firmado_en`, así que el firmante histórico sigue siendo consultable.

**Alternativa descartada:** baja lógica (`finalizado_en`). Conserva la fila, pero obliga a rehacer el índice único del tutor principal para que ignore las finalizadas, y añade un estado que todos los permisos tendrían que respetar.

**Trade-off:** no hay consulta directa de «quién fue tutor de quién» sin mirar la auditoría. Se acepta a cambio de un modelo más simple.

### 3. Barrido diario, no en tiempo real

La transición no necesita precisión de minutos: los permisos ya se cortan al autorizar. El barrido corre una vez al día y es idempotente.

### 4. El consentimiento nuevo se solicita, no se exige para agendar

Se crea la solicitud y se avisa al paciente. Bloquear la agenda hasta la firma castigaría al paciente por un trámite administrativo.

## Risks / Trade-offs

- **`fecha_nacimiento` opcional.** Un paciente sin fecha no cumple nunca la condición y conserva tutor indefinidamente. Se mitiga exigiendo la fecha cuando existe un vínculo de tutela.
- **Fecha de nacimiento incorrecta.** El traspaso ocurre en la fecha registrada; corregirla después no revierte lo hecho. Queda documentado.
- **Notificaciones al tutor saliente.** Se le avisa del cese, lo que puede sorprender si no lo esperaba; es preferible a un acceso silencioso.
