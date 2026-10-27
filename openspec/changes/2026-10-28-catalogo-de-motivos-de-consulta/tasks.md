# Tasks

## 1. Esquema y migración

- [ ] 1.1 Crear el modelo `motivos_consulta` (id, codigo único, etiqueta, categoria, activo, orden, es_otro, requiere_texto) y las relaciones `motivo_id` nullable en `citas` y `solicitudes_cita` con `onDelete: Restrict`; y verificar que `prisma validate` pasa y que el cliente generado expone las relaciones
- [ ] 1.2 Generar la migración con el flujo del proyecto (`migrate diff` + `migrate deploy`) sin usar `migrate dev`; y verificar que el SQL solo agrega tabla e índices y que no toca los objetos escritos a mano de la baseline
- [ ] 1.3 Cargar el catálogo inicial (categorías y motivos frecuentes, incluida la fila «Otro») mediante seed idempotente; y verificar que ejecutarlo dos veces no duplica filas

## 2. API

- [ ] 2.1 Implementar `GET /api/motivos-consulta` que devuelve solo motivos activos agrupados por categoría y ordenados; y verificar con test que un motivo inactivo no aparece
- [ ] 2.2 Validar en los endpoints de cita y solicitud que `motivo_id` exista y esté activo, y que «Otro» traiga texto libre; y verificar con tests los casos: motivo válido, motivo inexistente, motivo inactivo y «Otro» sin texto
- [ ] 2.3 Devolver en los DTOs de cita y solicitud la etiqueta del catálogo y el texto libre cuando corresponda; y verificar con test que una cita histórica sin `motivo_id` sigue mostrando su texto
- [ ] 2.4 Implementar el alta, edición y desactivación de motivos para el rol administrador, con rechazo de borrado cuando el motivo está en uso; y verificar con tests los casos: alta duplicada por código, desactivación y borrado bloqueado

## 3. Web

- [ ] 3.1 Reemplazar el campo de texto por un selector agrupado por categoría en «Solicitar cita» y «Nueva cita», con la opción «Otro» que revela un campo de texto obligatorio; y verificar con test que no se puede enviar «Otro» vacío
- [ ] 3.2 Mostrar el motivo en el detalle de la cita usando la etiqueta del catálogo cuando existe y el texto cuando no; y verificar con test el caso de una cita histórica
- [ ] 3.3 Añadir la pantalla de administración del catálogo (listar, crear, editar, activar/desactivar) visible solo para el rol administrador; y verificar con test que un usuario sin ese rol no accede

## 4. Verificación

- [ ] 4.1 Crear una cita con motivo del catálogo y otra con «Otro», y verificar que ambas se muestran correctamente en el detalle y que la segunda conserva el texto
- [ ] 4.2 Desactivar un motivo usado y verificar que desaparece del selector, que la cita existente sigue mostrándolo y que el borrado se rechaza
- [ ] 4.3 Ejecutar la consulta de conteo por motivo sobre los datos de prueba y verificar que devuelve resultados agrupados por categoría sin revisar textos

## Workflow follow-up

- Archivar el cambio cuando el catálogo esté cargado en producción y al menos un mes de citas nuevas lo use.
