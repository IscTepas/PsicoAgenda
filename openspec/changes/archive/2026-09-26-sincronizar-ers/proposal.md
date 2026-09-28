# 2026-09-26 Sincronización del ERS .docx con OpenSpec

## Why
El documento `PSICOAGENDA_RP33_ERS.docx` contenía la versión más actualizada y mejor estructurada de los requisitos de PsicoAgenda. Sin embargo:

- `psicoagenda_openspec.md` era un documento maestro plano incompleto (solo 45 líneas).
- `openspec/project.md` existía pero con alcance limitado y sin RNF/RD formales.
- `openspec/specs/` estaba vacío, por lo que el flujo spec-driven de OpenSpec no tenía especificaciones formales.

Este change registra la sincronización del ERS hacia la estructura formal de OpenSpec.

## What Changes

### Incluye
- Actualización completa de `psicoagenda_openspec.md` como documento maestro plano.
- Actualización de `openspec/project.md` con contexto, actores, RNF, RD y modelo de dominio.
- Creación de 6 capacidades formales en `openspec/specs/` con un total de 30 requirements.
- Corrección de inconsistencias de numeración en los RF del `.docx`.
- Actualización de `README.md` para reflejar el alcance real y aclarar `RD-14`.

### No incluye
- Modificación del archivo `.docx` original.
- Implementación de código de la aplicación.
- Desarrollo de módulos de facturación, videollamadas o expedientes interdisciplinarios.

## Fuente de verdad
`PSICOAGENDA_RP33_ERS.docx` (Documento ERS del proyecto PsicoAgenda).

## Estado
Aplicado y archivado el 2026-09-26.
