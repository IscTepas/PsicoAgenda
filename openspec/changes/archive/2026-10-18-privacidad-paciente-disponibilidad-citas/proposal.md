# Proposal: Ocultar tarjeta del paciente en rol paciente y sugerir próximo día disponible cuando no haya franjas

## Why

Cuando un paciente accede al formulario de solicitud/agendamiento de cita (`/agenda/nueva`), la interfaz no debe mostrarle la tarjeta de selección de paciente ("1. Paciente de la Consulta"), porque el paciente solo puede agendar/solicitar para sí mismo y el directorio de pacientes es exclusivo del psicólogo. Mostrar esa tarjeta al paciente rompe el acotamiento por rol y expone un dato que no le corresponde gestionar.

Además, cuando el paciente (o el psicólogo) elige un día que no tiene franjas horarias disponibles —por ejemplo un día fuera del horario laboral del profesional—, el formulario solo informa que no hay horarios sin ofrecer una alternativa. El sistema debería sugerir el próximo día futuro que sí tenga horarios configurados y permitir navegar a ese día con un clic, reduciendo fricción al solicitar cita.

## What Changes

- **Formulario de cita** (`apps/web/src/app/(app)/agenda/components/appointment-form.tsx`): ocultar la tarjeta "1. Paciente de la Consulta" (`Card 1`) cuando el rol efectivo es `PATIENT`; el paciente queda fijado a su propio registro mediante `lockedPatientId`.
- **Formulario de cita**: cuando el día seleccionado no tiene franjas disponibles (`availableHours.length === 0`), calcular el próximo día futuro con horarios del profesional (`nextAvailableDate`, hasta 30 días) y mostrar un botón "Ir al <día>" que precargue esa fecha y sus franjas.
- **Especificación**: sin requisitos nuevos a nivel de spec (`skip_specs: true`); el cambio ajusta la UI de disponibilidad ya contemplada en `appointment-management` (consultar disponibilidad / franjas libres).

## Capabilities

### New Capabilities
<!-- Ninguna: el cambio no introduce capacidades funcionales nuevas. -->

### Modified Capabilities
<!-- Ninguna: no cambian los requisitos a nivel de spec. Es un ajuste de comportamiento de la UI de agendamiento (`skip_specs: true`). -->

## Impact

- Código web: `apps/web/src/app/(app)/agenda/components/appointment-form.tsx`.
- Lógica de rol: reusa `useSession()` / `UserRole.PATIENT` y `effectiveRole` ya usados en el formulario.
- Horarios: reusa `PsychologistSchedule` de `psychologistService.getSchedule`/`getMySchedule` con fallback `FALLBACK_HOURS`.
- Sin cambios en `schema.prisma`, migraciones ni endpoints de la API.
- Nota: el comportamiento descrito ya está implementado en el código (working tree limpio). Este change documenta y captura la decisión arquitectónica en OpenSpec.
