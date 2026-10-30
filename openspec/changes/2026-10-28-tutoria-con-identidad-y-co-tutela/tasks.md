# Tasks

## 1. Esquema y migración con backfill

- [x] 1.1 Añadir `usuario_id` nullable y único a `tutores` con su relación a `usuarios`; y verificar que `prisma validate` pasa y que el cliente generado expone la relación
- [x] 1.2 Crear la tabla `pacientes_tutores` (`paciente_id`, `tutor_id`, `es_principal`, `creado_en`) con unicidad por par y índice único parcial que garantice un solo principal por paciente; y verificar en la base que dos principales para el mismo paciente fallan
- [x] 1.3 Escribir la migración en tres pasos (crear tabla, copiar cada `tutor_legal_id` como vínculo principal, eliminar la columna) y aplicarla primero en el entorno aislado; y verificar que el número de vínculos creados coincide con el número de pacientes que tenían tutor
- [x] 1.4 Verificar que no queda ningún paciente menor sin tutor tras la migración; y verificar con una consulta de conteo que devuelve cero filas

## 2. Autorización por vínculo

- [x] 2.1 Implementar un guard único que resuelva si el usuario autenticado puede operar sobre un paciente (él mismo, tutor vinculado, psicólogo tratante o administrador); y verificar con tests los cuatro casos y el caso negativo
- [x] 2.2 Aplicar el guard a los endpoints de citas y solicitudes, sustituyendo las comprobaciones por rol; y verificar con tests que un tutor puede operar sobre el menor y que un tercero no puede
- [x] 2.3 Rechazar la tutoría de sí mismo y la del psicólogo tratante; y verificar con tests ambos rechazos

## 3. Gestión de tutores

- [x] 3.1 Implementar el alta de tutor desde el expediente, permitiendo enlazar un usuario existente por correo o registrar un contacto sin cuenta; y verificar con tests ambos caminos y el rechazo de duplicados
- [x] 3.2 Implementar el listado, la designación de principal y la desvinculación de tutores de un paciente; y verificar con test que al desvincular al principal se exige designar otro o queda el paciente sin principal de forma explícita
- [ ] 3.3 Conservar y mostrar el tutor que firmó cada consentimiento tras la migración; y verificar que los consentimientos existentes siguen resolviendo su firmante

## 4. Agenda y avisos del menor

- [x] 4.1 Permitir elegir, al agendar, entre el propio paciente y los menores que tutela, y registrar quién solicitó la cita; y verificar con test que la cita queda a nombre del menor con el tutor como solicitante
- [x] 4.2 Incluir a los tutores vinculados como destinatarios de los avisos de agenda del menor, respetando sus preferencias de canal; y verificar con test que un tutor sin canales activos no recibe mensajes
- [x] 4.3 Verificar que el tutor no puede abrir bitácora ni notas clínicas del menor; y verificar con tests de API que ambos endpoints responden con error de autorización

## 5. Verificación integral

- [ ] 5.1 Repetir en el entorno aislado el flujo completo: paciente adulto con cuenta, vinculado como tutor de un menor, agenda una cita y recibe el recordatorio; y verificar que su propio expediente no se altera
- [ ] 5.2 Verificar el caso de dos tutores con un principal: ambos ven la agenda del menor y solo el principal recibe el tratamiento de contacto preferente; y comprobar que el índice parcial impide dos principales

## Workflow follow-up

- Archivar el cambio después de la migración en producción verificada por conteo y del flujo completo en el entorno aislado.
