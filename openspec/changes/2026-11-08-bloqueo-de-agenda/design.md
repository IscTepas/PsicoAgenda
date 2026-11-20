# Design

## Context

`citas` ya protege el solape entre citas con dos `EXCLUDE` de Postgres (por psicólogo y por paciente) y una comprobación previa en `assertNoOverlap`. La agenda web pinta las citas por día, semana y mes, y las franjas libres se derivan de la ausencia de citas. No existe ningún concepto de indisponibilidad declarada por el profesional.

Las migraciones son SQL escritas a mano y aplicadas con `migrate deploy`; la baseline incluye objetos que Prisma no modela, así que no se usa `migrate dev`.

## Goals / Non-Goals

**Goals**

- Que el profesional declare indisponibilidad en dos toques, sin crear citas falsas.
- Que ningún camino de escritura acepte una cita sobre un bloqueo, y que el mensaje diga por qué.
- Que el calendario refleje el bloqueo sin volverlo un objeto clicable que compita con las citas.
- Que dos bloqueos no puedan solaparse ni en concurrencia.

**Non-Goals**

- Bloqueos recurrentes o plantillas («todos los viernes por la tarde»).
- Edición en sitio de un bloqueo: se elimina y se crea de nuevo.
- Integración con calendarios externos.

## Decisions

### 1. El rango se guarda como instantes y `todo_el_dia` es presentación

`fecha_inicio` y `fecha_fin` son `TIMESTAMPTZ`. Un bloqueo de día completo lo envía el cliente como `00:00` local a `00:00` del día siguiente; `todo_el_dia` solo controla cómo se pinta («Todo el día» frente a un rango de horas). Guardar instantes mantiene una sola comparación de solape para ambos casos y evita reinterpretar zonas horarias en la base.

**Trade-off:** el cliente es responsable de calcular el día completo. Se acota con `CHECK (fecha_fin > fecha_inicio)` y validación en el esquema compartido.

### 2. `EXCLUDE` entre bloqueos, guard de aplicación entre bloqueo y cita

Un `EXCLUDE` en `bloqueos_agenda` con `btree_gist` impide que dos bloqueos del mismo psicólogo se crucen, incluso si dos peticiones pasan la validación a la vez. El solape bloqueo ↔ cita no puede expresarse con un `EXCLUDE` porque son tablas distintas; se comprueba dentro de la misma transacción que escribe la cita o la solicitud con `assertNoAgendaBlock`.

**Trade-off:** queda una carrera entre una cita y un bloqueo creados simultáneamente. Se acepta: el peor caso es una cita sobre un bloqueo recién creado, visible de inmediato en el calendario. Cerrarla exigiría un lock de asesoría por psicólogo que no compensa el coste.

### 3. Intervalos semiabiertos

La comparación es `fecha_inicio < fin AND fecha_fin > inicio`. Un bloqueo que termina a las 11:00 no choca con una cita que empieza a las 11:00, igual que el resto de la agenda.

### 4. El psicólogo sale de la sesión, nunca del cuerpo

`createAgendaBlock` y `deleteAgendaBlock` resuelven el perfil con `requirePsychologistIdByUser(auth.id)`. El cuerpo solo aporta fechas y motivo. Así no hace falta confiar en un `psychologistId` enviado por el cliente ni comprobar propiedad en el alta.

### 5. Lectura acotada por rol

- PSICÓLOGO: sus propios bloqueos.
- PACIENTE o tutor: los del psicólogo que atiende a sus pacientes vinculados.
- ADMIN: debe indicar `psychologistId`; no se devuelve la agenda de todos por defecto.

### 6. `409 AGENDA_BLOQUEADA` con detalles

El guard lanza un `AppError` con código propio y `details: { blockId, allDay, reason }`. El frontend puede distinguirlo de un solape de cita y mostrar el motivo real del bloqueo; el mensaje ya viene en español desde el servidor.

### 7. Tarjetas no interactivas y gestión en un diálogo

En el calendario, un bloqueo es información, no una acción: se pinta con `bg-[#242424]`, `border-gray-800` y `opacity-60`, sin botones, para no competir con las citas. El borrado vive en `GestionBloqueosDialog`, que lista los bloqueos del periodo visible y pide confirmación. Se evita el borrado accidental desde una tarjeta pequeña en el móvil.

## Risks / Trade-offs

- **Bloqueos huérfanos de presentación.** Si el cliente calcula mal el día completo, la etiqueta «Todo el día» puede no coincidir con el rango. El `CHECK` y la validación compartida acotan el daño; el rango sigue siendo la fuente de verdad.
- **Sin edición.** Corregir un bloqueo exige borrarlo y crearlo. Es aceptable por la baja frecuencia y evita un `PATCH` con reglas de solape adicionales.
- **Carga por periodo.** El calendario recarga los bloqueos al cambiar de vista o de fecha, igual que las citas. Un rango mensual incluye los días de los extremos para no dejar fuera bloqueos que cruzan el límite.
- **Concurrencia bloqueo ↔ cita.** Documentada arriba; se asume.
