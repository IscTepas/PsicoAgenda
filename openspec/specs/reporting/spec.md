# Gestión de Reportes

## Purpose

Generación de reportes estadísticos sobre la actividad clínica: número de consultas, distribución temporal, tasas de asistencia/cancelación, y exportación a PDF o Excel.

## Requirements

### Requirement: Reportes estadísticos de consultas
El sistema SHALL generar reportes con indicadores del número de consultas, su distribución temporal y las tasas de asistencia y cancelación en un período.

#### Scenario: Generar reporte de un período
- **WHEN** el psicólogo solicita un reporte indicando tipo y rango de fechas
- **THEN** el sistema SHALL calcular el número de consultas, su distribución temporal y las tasas de asistencia y cancelación del período

### Requirement: Exportación a PDF o Excel
El sistema SHALL permitir exportar los reportes generados a formatos PDF o Excel.

#### Scenario: Exportar reporte
- **WHEN** el psicólogo exporta un reporte generado
- **THEN** el sistema SHALL producir el archivo en el formato solicitado (PDF o Excel) con el rango de fechas y la fecha de generación
