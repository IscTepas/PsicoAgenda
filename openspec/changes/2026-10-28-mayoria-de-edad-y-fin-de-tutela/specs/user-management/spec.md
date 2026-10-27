# Spec Delta

## ADDED Requirements

### Requirement: Fin de la tutoría al alcanzar la mayoría de edad

El sistema SHALL considerar vigente una tutoría solo mientras el paciente sea menor de edad, y al cumplir 18 años SHALL finalizar todos sus vínculos de tutela y retirar los permisos asociados.

#### Scenario: El paciente cumple 18

- **WHEN** un paciente con tutores vinculados alcanza la mayoría de edad
- **THEN** el sistema finaliza todos sus vínculos de tutela y los tutores dejan de poder gestionar su agenda

#### Scenario: Co-tutela al cumplir 18

- **WHEN** el paciente tenía más de un tutor vinculado
- **THEN** el sistema finaliza todos los vínculos, no solo el principal

#### Scenario: Tutoría vencida sin barrido

- **WHEN** el proceso de finalización no se ha ejecutado todavía y el paciente ya cumplió 18
- **THEN** el sistema niega igualmente los permisos del tutor al autorizar la operación

#### Scenario: Transición registrada

- **WHEN** se finaliza una tutoría por mayoría de edad
- **THEN** el sistema registra la transición y notifica al paciente y a los tutores afectados

### Requirement: Titularidad y consentimiento al cumplir la mayoría de edad

El sistema SHALL reconocer al paciente como titular de su cuenta y de la gestión de su agenda al cumplir 18 años, SHALL solicitarle un consentimiento informado nuevo y SHALL conservar los consentimientos firmados por el tutor como histórico.

#### Scenario: Consentimiento firmado por el tutor

- **WHEN** el paciente cumple 18 y tenía un consentimiento firmado por su tutor
- **THEN** el sistema lo conserva como histórico y solicita al paciente uno nuevo

#### Scenario: Gestión de la propia agenda

- **WHEN** el paciente cumple 18
- **THEN** puede agendar, reprogramar y cancelar sus citas sin intervención de un tutor
