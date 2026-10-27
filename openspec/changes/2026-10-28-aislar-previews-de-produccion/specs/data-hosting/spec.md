# Spec Delta

## ADDED Requirements

### Requirement: Aislamiento de entornos de ejecución

El sistema SHALL ejecutar los entornos de prueba y de vista previa sobre una base de datos distinta de la de producción, de modo que ninguna operación realizada fuera de producción altere los datos clínicos reales.

#### Scenario: Vista previa conectada al entorno aislado

- **WHEN** se abre un deployment de vista previa
- **THEN** el backend responde usando la base de datos aislada y no la de producción

#### Scenario: Escritura desde una vista previa

- **WHEN** un revisor crea o modifica un registro desde un deployment de vista previa
- **THEN** el registro aparece en la base aislada y no existe en producción

#### Scenario: Entorno aislado sin datos reales

- **WHEN** se prepara el entorno aislado
- **THEN** se puebla con datos sintéticos y no con información identificable de pacientes reales
