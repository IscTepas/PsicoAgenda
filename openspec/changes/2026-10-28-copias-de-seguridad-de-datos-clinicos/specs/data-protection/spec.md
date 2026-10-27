# Spec Delta

## MODIFIED Requirements

### Requirement: Respaldo en AWS
El sistema SHALL realizar respaldos diarios y cifrados de la información fuera del proveedor que aloja la base de datos, conservarlos por al menos 30 días y verificar periódicamente que una copia puede restaurarse en un entorno aislado.

#### Scenario: Respaldo programado
- **WHEN** se ejecuta el trabajo de respaldo programado
- **THEN** el sistema genera una copia cifrada y la almacena en la infraestructura cloud configurada

#### Scenario: Restauración comprobada
- **WHEN** se ejecuta la prueba de restauración periódica
- **THEN** el sistema restaura la copia en un entorno aislado y confirma que las tablas clínicas coinciden en conteo con la base de origen

#### Scenario: Copia ausente o fallida
- **WHEN** transcurren 24 horas sin una copia nueva o la última ejecución falló
- **THEN** el sistema alerta al equipo responsable
