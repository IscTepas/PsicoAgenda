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
