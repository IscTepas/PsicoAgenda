# Spec Delta

## ADDED Requirements

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
