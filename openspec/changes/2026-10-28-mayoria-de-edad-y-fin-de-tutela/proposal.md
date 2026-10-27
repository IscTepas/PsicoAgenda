# Proposal

## Why

Con la tutoría ya modelada, falta el final del ciclo: nada ocurre cuando un paciente menor cumple 18 años. El vínculo del tutor sigue vigente, el tutor conserva los permisos de agenda y el consentimiento informado sigue firmado por una persona que ya no lo representa legalmente. Es un problema de acceso y también de consentimiento: quien firma debe ser quien puede hacerlo.

Depende de `2026-10-28-tutoria-con-identidad-y-co-tutela`.

## What Changes

- La tutoría SHALL aplicar solo mientras el paciente sea menor de edad.
- Al cumplir 18, el sistema SHALL finalizar todos los vínculos de tutela del paciente y retirar sus permisos.
- El paciente SHALL pasar a ser titular de su propia cuenta y de la gestión de su agenda.
- El sistema SHALL solicitar un consentimiento informado nuevo al paciente y SHALL conservar los firmados por el tutor como histórico.
- SHALL registrarse la transición y SHALL notificarse al paciente y a los tutores.
- La regla SHALL evaluarse también al momento de autorizar, no solo en el proceso de limpieza.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `user-management`: se añade el fin de la tutoría al alcanzar la mayoría de edad y el traspaso de la titularidad.

## Impact

- **API**: comprobación de mayoría de edad en el guard de autorización, barrido de finalización, notificaciones y registro de auditoría.
- **Web**: aviso del traspaso en el perfil y en el expediente.
- **Datos**: los vínculos de tutela se eliminan; los consentimientos firmados se conservan. No hay cambios de esquema.
- **Dependencia operativa**: el barrido reutiliza el disparador programado del despacho de notificaciones.
