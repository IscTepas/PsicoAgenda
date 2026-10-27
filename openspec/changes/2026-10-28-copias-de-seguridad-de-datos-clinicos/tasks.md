# Tasks

## 1. Copia de seguridad

- [ ] 1.1 Implementar el script de copia (`pg_dump` en formato custom, comprimido y cifrado) que toma la cadena de conexión del entorno; y verificar que el archivo resultante se lista correctamente con `pg_restore --list`
- [ ] 1.2 Configurar el almacenamiento externo y una credencial de solo escritura; y verificar que puede subir objetos y que la misma credencial no puede borrarlos
- [ ] 1.3 Programar la copia diaria y la política de retención (30 días más una copia mensual); y verificar durante dos ejecuciones consecutivas que aparece la copia nueva y se purga la que excede la política
- [ ] 1.4 Documentar en el script y en el runbook la custodia de la clave de cifrado; y verificar que la clave no está en el repositorio ni en el mismo almacenamiento que las copias

## 2. Restauración verificada

- [ ] 2.1 Ejecutar una restauración completa en el entorno aislado y medir el tiempo; y verificar que `pacientes`, `citas` y `expedientes_clinicos` coinciden en conteo con la base de origen
- [ ] 2.2 Registrar el RPO y RTO obtenidos frente al objetivo declarado; y verificar que el documento indica la diferencia y qué se decidió al respecto

## 3. Operación y decisión

- [ ] 3.1 Configurar la alerta de copia fallida o ausente en 24 horas; y verificar simulando una credencial inválida que la alerta llega
- [ ] 3.2 Documentar el runbook de restauración paso a paso con el tiempo medido; y verificar que otra persona lo ejecuta en el entorno aislado sin ayuda
- [ ] 3.3 Registrar en `design.md` la decisión entre copia propia sobre el plan gratuito y el plan Pro con recuperación a un punto en el tiempo, con costo y beneficio; y verificar que la decisión queda fechada y firmada por quien corresponde

## Workflow follow-up

- Archivar el cambio después de la primera restauración verificada; una copia sin restaurar no cierra este cambio.
