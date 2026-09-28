# Tareas — 2026-09-26 Sincronización del ERS .docx con OpenSpec

## Completadas

- [x] Extraer y revisar el contenido completo de `PSICOAGENDA_RP33_ERS.docx`.
- [x] Identificar y documentar inconsistencias en la numeración de RF del `.docx`.
- [x] Definir numeración corregida de RF (RF_US_001 a RF_US_028).
- [x] Actualizar `psicoagenda_openspec.md` con:
  - Visión general, alcance, definiciones, referencias.
  - Actores, módulos y casos de uso.
  - 28 RF detallados.
  - 9 RNF.
  - 14 RD.
  - Restricciones, supuestos, dependencias, requisitos futuros.
  - Modelo de dominio ampliado.
  - Características de los usuarios.
- [x] Actualizar `openspec/project.md` con contexto formal del proyecto.
- [x] Crear capacidad `user-management` (5 requirements).
- [x] Crear capacidad `appointment-management` (5 requirements).
- [x] Crear capacidad `notification-management` (3 requirements).
- [x] Crear capacidad `medical-record` (7 requirements).
- [x] Crear capacidad `reporting` (2 requirements).
- [x] Crear capacidad `data-protection` (8 requirements).
- [x] Actualizar `README.md`:
  - Recordatorios por WhatsApp y correo.
  - Aclaración de que `RD-14` es control de estado de pago, no facturación.
- [x] Validar especificaciones con `openspec validate --specs`.
- [x] Crear este change y archivarlo.

## Pendientes futuros (fuera de este change)
- Implementar el código de la aplicación conforme a las especificaciones.
- Definir stack tecnológico completo en `openspec/config.yaml`.
- Crear diagramas de arquitectura y modelos de datos detallados.
