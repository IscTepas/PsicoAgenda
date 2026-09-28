# Diseño — 2026-09-26 Sincronización del ERS .docx con OpenSpec

## Enfoque general
Se adoptó un enfoque de **spec-driven development** con OpenSpec. La fuente de verdad fue el documento `PSICOAGENDA_RP33_ERS.docx`; a partir de él se reconstruyeron y estructuraron los artefactos formales del proyecto.

## Decisiones clave

### 1. Uso del `.docx` como fuente de verdad
Se utilizó el `.docx` como referencia principal porque era el documento más actualizado y mejor estructurado. El markdown maestro (`psicoagenda_openspec.md`) se actualizó para reflejarlo fielmente.

### 2. Corrección de numeración de RF
El `.docx` contenía códigos duplicados (`RF_US_007` aparecía dos veces) y conflictivos (`RF_US_002` tenía significados distintos según el actor). Se definió una numeración única y coherente:

- **Paciente:** RF_US_001 – RF_US_009
- **Psicólogo/a:** RF_US_010 – RF_US_021
- **Sistema:** RF_US_022 – RF_US_028

### 3. Organización en 6 capacidades
Los 30 requirements se distribuyeron en capacidades alineadas con los módulos funcionales del sistema:

| Capacidad | Requirements |
|---|---|
| user-management | 5 |
| appointment-management | 5 |
| notification-management | 3 |
| medical-record | 7 |
| reporting | 2 |
| data-protection | 8 |

### 4. Manejo de `RD-14`
El requisito de dominio `RD-14` habla de un *estado de pago de honorarios* (pendiente/pagado). Se aclaró explícitamente que esto no constituye un módulo de facturación electrónica ni contabilidad, manteniendo coherencia con el alcance del proyecto.

### 5. Modelo de dominio ampliado
Se conservaron las entidades originales del markdown maestro y se agregaron:
- `EntradaBitacora` para trazabilidad de sesiones.
- `ConsentimientoInformado` para registrar consentimientos y tutores legales.
- `PagoHonorario` para el control administrativo del estado de pago.

## Formato de especificaciones
Todas las especificaciones formales siguen el esquema `spec-driven` de OpenSpec:

```markdown
## Purpose
...

## Requirements
### Requirement: ...
[Actor] SHALL ...

#### Scenario: ...
- **WHEN** ...
- **THEN** ...
```

## Validación
Las especificaciones fueron validadas exitosamente con:

```bash
openspec validate --specs
```

Resultado: `6 passed, 0 failed`.
