# Proposal

## Why

El tutor legal es hoy un contacto suelto: la tabla `tutores` guarda nombre, teléfono y parentesco, sin `usuario_id` ni correo, y `pacientes.tutor_legal_id` admite **un solo** tutor por paciente. Eso hace imposible el caso que motiva este cambio: que un paciente —una persona que ya tiene cuenta— sea tutor de un menor. Hoy habría que duplicarla en `tutores` sin vínculo con su cuenta, y aun así no tendría ningún permiso sobre el menor. Tampoco existe co-tutela: madre y padre no pueden figurar ambos.

## What Changes

- `tutores` SHALL identificar a una persona y SHALL poder referenciar su cuenta de usuario cuando la tenga.
- El vínculo tutor–paciente SHALL ser de muchos a muchos, con exactamente un tutor principal por paciente.
- Un tutor SHALL poder gestionar las citas del menor y recibir sus avisos, y SHALL NOT acceder a la bitácora ni a las notas clínicas.
- Ser tutor SHALL NOT cambiar el rol de la cuenta ni mezclar expedientes.
- El sistema SHALL impedir que alguien sea tutor de sí mismo y que el psicólogo tratante sea tutor de su paciente.
- Los vínculos existentes SHALL migrarse como principales, sin perder ningún paciente con tutor.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `user-management`: se añade la tutoría con identidad de usuario y co-tutela, con sus límites de acceso.
- `appointment-management`: se añade la gestión de citas por parte del tutor legal del paciente.
- `notification-management`: los avisos de un menor SHALL llegar también a sus tutores.

## Impact

- **Base de datos**: `tutores.usuario_id`, nueva tabla `pacientes_tutores` y migración de `pacientes.tutor_legal_id` (se elimina tras el backfill). `consentimientos_informados.tutor_legal_id` no cambia.
- **API**: resolución de permisos por vínculo, endpoints de tutores, validación en agendamiento y notificaciones.
- **Web**: sección de tutores en el expediente y selección de paciente al agendar cuando se tutela a un menor.
- **Fuera de alcance**: quién posee las credenciales del menor (cambio aparte), acceso del tutor al expediente clínico (se excluye a propósito).
