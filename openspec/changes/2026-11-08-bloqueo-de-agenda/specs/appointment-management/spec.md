# Spec Delta

## ADDED Requirements

### Requirement: Bloqueo de agenda

El sistema SHALL permitir al psicólogo declarar rangos en los que no atiende, con inicio, fin, bandera de día completo y motivo opcional de hasta 100 caracteres. El sistema SHALL NOT permitir que dos bloqueos del mismo psicólogo se solapen.

#### Scenario: Alta de un bloqueo de día completo

- **WHEN** el psicólogo elige una fecha y guarda un bloqueo de día completo
- **THEN** el sistema registra el rango de `00:00` local a `00:00` del día siguiente y lo muestra como «Todo el día»

#### Scenario: Alta de un bloqueo por horas

- **WHEN** el psicólogo desactiva «Todo el día», indica una hora de inicio y una de fin posteriores y guarda
- **THEN** el sistema registra el rango parcial con el motivo, si lo escribió

#### Scenario: Fin no posterior al inicio

- **WHEN** el psicólogo envía un bloqueo cuya fecha de fin no es posterior a la de inicio
- **THEN** el sistema rechaza la petición con `400` y no crea el bloqueo

#### Scenario: Motivo demasiado largo

- **WHEN** el motivo supera los 100 caracteres
- **THEN** el sistema rechaza la petición con `400`

#### Scenario: Solape entre bloqueos

- **WHEN** el psicólogo intenta crear un bloqueo que se cruza con otro suyo
- **THEN** el sistema responde `409` y no crea el bloqueo, incluso si las dos peticiones son simultáneas

#### Scenario: Borrado de un bloqueo ajeno

- **WHEN** un psicólogo intenta eliminar un bloqueo de otro profesional
- **THEN** el sistema responde `403` y conserva el bloqueo

### Requirement: El bloqueo impide agendar

El sistema SHALL rechazar con `409` cualquier cita o solicitud de cita que se cruce con un bloqueo del psicólogo, en el alta, la reprogramación, la aceptación de una solicitud y la creación de una solicitud.

#### Scenario: Cita sobre un bloqueo

- **WHEN** se intenta crear o mover una cita a un horario bloqueado
- **THEN** el sistema responde `409` con el código `AGENDA_BLOQUEADA`, el identificador del bloqueo, si es de día completo y su motivo, y no escribe la cita

#### Scenario: Solicitud sobre un bloqueo

- **WHEN** un paciente solicita una cita o pide reprogramarla a un horario bloqueado
- **THEN** el sistema responde `409` y no registra la solicitud

#### Scenario: Franja contigua

- **WHEN** una cita empieza exactamente a la hora en que termina un bloqueo
- **THEN** el sistema la acepta, porque el intervalo del bloqueo es semiabierto

### Requirement: Visualización y consulta de bloqueos

El sistema SHALL mostrar los bloqueos junto a las citas en las vistas de día, semana y mes, sin acciones sobre la tarjeta, y SHALL permitir consultarlos por rango de fechas según el rol de la sesión.

#### Scenario: Consulta por rango

- **WHEN** el calendario solicita los bloqueos de un periodo con `from`/`to` o con `startDate`/`endDate`
- **THEN** el sistema devuelve los bloqueos del psicólogo que se cruzan con ese periodo

#### Scenario: Consulta de un paciente

- **WHEN** un paciente o su tutor consulta un rango
- **THEN** el sistema devuelve solo los bloqueos del psicólogo que atiende a sus pacientes vinculados

#### Scenario: Tarjeta de bloqueo en el calendario

- **WHEN** la agenda pinta un bloqueo
- **THEN** muestra el motivo o «No disponible» en una tarjeta atenuada sin botones ni acciones

#### Scenario: Gestión de bloqueos

- **WHEN** el psicólogo abre la gestión de bloqueos del periodo visible
- **THEN** puede confirmar el borrado de un bloqueo y la agenda deja de mostrarlo

#### Scenario: Error al cargar bloqueos

- **WHEN** falla la consulta de bloqueos
- **THEN** la agenda muestra un aviso y mantiene visibles las citas
