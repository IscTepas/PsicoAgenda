# Tasks

## 1. Regla de vigencia

- [ ] 1.1 Incorporar la edad al guard de autorización por vínculo: un vínculo de tutela solo autoriza si el paciente es menor de 18 años; y verificar con tests que un paciente que acaba de cumplir 18 ya no autoriza a su tutor
- [ ] 1.2 Exigir `fecha_nacimiento` cuando existe un vínculo de tutela; y verificar con test que no se puede crear o mantener la tutoría de un paciente sin fecha
- [ ] 1.3 Documentar la regla en el guard y en el diseño de la tutoría; y verificar que el comentario explica por qué la comprobación no vive solo en el barrido

## 2. Barrido de finalización

- [ ] 2.1 Implementar el barrido que detecta pacientes con vínculos de tutela que ya cumplieron 18 años, elimina esos vínculos y registra la transición en auditoría; y verificar con test que es idempotente y que finaliza todos los vínculos, no solo el principal
- [ ] 2.2 Enganchar el barrido al disparador programado existente con frecuencia diaria; y verificar en el entorno desplegado que la ejecución aparece en los registros y que no altera los avisos del despacho
- [ ] 2.3 Notificar al paciente y a los tutores cesantes; y verificar con test que se generan los avisos y que un tutor sin canales activos no recibe nada

## 3. Consentimiento y titularidad

- [ ] 3.1 Marcar los consentimientos firmados por el tutor como histórico y crear la solicitud de consentimiento nuevo al paciente; y verificar con test que el consentimiento anterior no se modifica ni se borra
- [ ] 3.2 Verificar que, tras la transición, el paciente puede agendar, reprogramar y cancelar por sí mismo; y verificar con tests que ya no necesita tutor y que sus permisos son los de un paciente mayor de edad

## 4. Interfaz

- [ ] 4.1 Mostrar en el perfil del paciente el aviso de que su tutoría finalizó y que ahora gestiona su propia agenda; y verificar que el aviso solo aparece después de la transición
- [ ] 4.2 Retirar del expediente las acciones de tutor para esos pacientes; y verificar en la interfaz que un paciente mayor no ofrece vincular tutores

## 5. Verificación integral

- [ ] 5.1 Simular en el entorno aislado un paciente con dos tutores que cumple 18: verificar el corte de permisos al autorizar, la limpieza por barrido, la auditoría y los avisos
- [ ] 5.2 Verificar que un paciente con tutor y sin `fecha_nacimiento` no puede existir tras el cambio; y comprobar el rechazo en el alta

## Workflow follow-up

- Archivar el cambio después de la primera transición real o simulada en el entorno aislado, con auditoría y avisos verificados.
