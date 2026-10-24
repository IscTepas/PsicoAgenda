## Purpose
Administración de la agenda clínica: programar, modificar, cancelar y consultar citas; verificar disponibilidad para evitar empalmes; y registrar la asistencia de los pacientes.

## Requirements

### Requirement: Programar cita
El sistema SHALL permitir a pacientes y psicólogos/as agendar una sesión seleccionando fecha, hora, motivo y profesional.

#### Scenario: Programación exitosa
- **WHEN** un usuario selecciona una fecha y hora disponibles con un psicólogo/a
- **THEN** el sistema reserva el espacio, registra la cita y notifica a ambas partes

### Requirement: Modificar cita
El sistema SHALL permitir cambiar la fecha, hora o motivo de una cita previamente agendada.

#### Scenario: Modificación con disponibilidad
- **WHEN** un usuario solicita cambiar una cita a una nueva fecha y hora disponibles
- **THEN** el sistema actualiza el registro, reprograma las notificaciones y alerta al paciente y al psicólogo/a

#### Scenario: Modificación sin disponibilidad
- **WHEN** un usuario solicita cambiar una cita a una fecha u hora no disponible
- **THEN** el sistema muestra un mensaje indicando la falta de disponibilidad y solicita otra opción

### Requirement: Cancelar cita
El sistema SHALL permitir cancelar una cita programada y liberar el horario correspondiente.

#### Scenario: Cancelación de cita
- **WHEN** un usuario o psicólogo/a cancela una cita vigente
- **THEN** el sistema actualiza el estado a "Cancelada", libera el horario y notifica a la contraparte

### Requirement: Consultar agenda y verificar disponibilidad
El sistema SHALL mostrar el calendario de citas programadas y los espacios disponibles para agendar.

#### Scenario: Visualización de agenda
- **WHEN** un usuario consulta su agenda con un rango de fechas
- **THEN** el sistema muestra las citas organizadas por día, semana o mes con indicadores de estado

#### Scenario: Verificación de disponibilidad
- **WHEN** un paciente consulta los horarios disponibles de un psicólogo/a
- **THEN** el sistema muestra los bloques libres según la configuración de horarios laborales

### Requirement: Registrar asistencia
El sistema SHALL registrar si el paciente asistió o no a la cita programada.

#### Scenario: Registro de asistencia
- **WHEN** el psicólogo/a marca el estado de asistencia de una cita
- **THEN** el sistema actualiza el estado de la cita y vincula el registro al historial del paciente

### Requirement: Visibilidad del detalle de cita por rol

El sistema SHALL NO mostrar al usuario con rol PACIENTE las tarjetas con información personal del paciente ni las acciones de acceso al expediente clínico en el diálogo de detalle de cita. El sistema SHALL seguir mostrándolas al usuario con rol PSICOLOGO.

#### Scenario: Detalle de cita para paciente oculta información del paciente

- **WHEN** un usuario con rol de paciente abre el diálogo de detalle de una cita
- **THEN** el sistema no muestra tarjetas con información personal del paciente ni el botón "Ver Expediente"

#### Scenario: Detalle de cita para psicólogo muestra información del paciente

- **WHEN** un usuario con rol de psicólogo/a abre el diálogo de detalle de una cita
- **THEN** el sistema muestra la tarjeta con información del paciente y el botón "Ver Expediente"

### Requirement: Fecha y disponibilidad al agendar una cita

El sistema SHALL arrancar los flujos de cita nueva sin fecha ni hora preseleccionadas. Al elegir una fecha SHALL mostrar su disponibilidad con color y texto, SHALL ocultar las franjas que ya pasaron cuando la fecha es hoy y SHALL impedir que un paciente solicite una cita para el mismo día. La edición SHALL conservar la fecha y la hora de la cita.

#### Scenario: Cita nueva sin fecha

- **WHEN** una persona abre "Solicitar cita" o "Nueva cita" sin parámetros
- **THEN** el campo de fecha está vacío, no hay horas visibles y se indica que elija una fecha

#### Scenario: Paciente y mismo día

- **WHEN** un paciente intenta elegir la fecha de hoy
- **THEN** el sistema la ajusta a mañana y no muestra el atajo "Hoy"

#### Scenario: Psicólogo y hoy

- **WHEN** un psicólogo elige hoy en "Nueva cita"
- **THEN** puede agendar y solo ve las franjas que todavía no empezaron

#### Scenario: Edición de una cita de hoy

- **WHEN** se edita una cita de hoy cuya hora ya pasó
- **THEN** la fecha y su franja se conservan y el resto de horas pasadas se ocultan

#### Scenario: Color de la fecha

- **WHEN** se elige una fecha
- **THEN** el preview se muestra verde si hay horarios libres, ámbar si el día está completo y rojo si no tiene horario, con una etiqueta de texto y una leyenda

#### Scenario: Día completo

- **WHEN** todas las franjas del día están ocupadas
- **THEN** no se preselecciona ninguna franja y no se muestra el costo de la sesión
