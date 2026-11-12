# Tasks

## 1. Datos

- [x] 1.1 Modelar `bloqueos_agenda` (id UUID, psicólogo, inicio, fin, día completo, motivo máximo 100) y escribir la migración con FK, índice, `CHECK` de rango válido y `EXCLUDE` de solape; verificar que dos bloqueos del mismo psicólogo no se solapan
- [x] 1.2 Regenerar el cliente de Prisma y comprobar que el proyecto compila con el modelo nuevo

## 2. API

- [x] 2.1 Añadir `AgendaBlock` y los esquemas compartidos de alta y de rango de consulta; verificar que se rechaza un fin no posterior al inicio y un motivo de más de 100 caracteres
- [x] 2.2 Implementar `POST /api/bloqueos`, `GET /api/bloqueos` y `DELETE /api/bloqueos/:id` con scoping por rol y 409 legible ante el `EXCLUDE`; verificar que un psicólogo no puede borrar el bloqueo de otro
- [x] 2.3 Enlazar `assertNoAgendaBlock` en el alta de cita, la reprogramación, la aceptación de solicitud y la nueva solicitud; verificar que una cita sobre un bloqueo responde 409 con `AGENDA_BLOQUEADA` y los detalles
- [x] 2.4 Cubrir esquemas, scoping, borrado y guard con pruebas en `apps/api/tests/agenda-block.service.test.ts`; verificar que pasan junto a las suites de citas

## 3. Web

- [x] 3.1 Crear el cliente `agendaBlockService` y el modal «Bloquear agenda» con fecha, interruptor de día completo, dos horas y motivo opcional; verificar que un fin anterior al inicio se señala en el formulario
- [x] 3.2 Integrar los bloqueos en la agenda: carga por rango visible, botón de alta, diálogo de gestión y tarjetas no interactivas en día, semana y mes; verificar que la tarjeta muestra el motivo o «No disponible» y no abre ninguna acción
- [x] 3.3 Mostrar el error de carga de bloqueos sin tumbar el resto de la agenda y refrescar la lista al crear o eliminar un bloqueo

## 4. Verificación

- [x] 4.1 Ejecutar `npm run typecheck`, `npm run lint` y `npm test` en la raíz del workspace; verificar que no quedan errores
