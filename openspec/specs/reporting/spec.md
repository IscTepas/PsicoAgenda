## Purpose
Generación de reportes operativos del consultorio: consultas por período, distribución temporal, tasas de asistencia/cancelación y pacientes atendidos, con exportación a PDF y Excel.

## Requirements

### Requirement: Generar reportes de citas
El sistema SHALL generar reportes de citas realizadas o programadas en un período determinado aplicando filtros.

#### Scenario: Generación de reporte filtrado
- **WHEN** el psicólogo/a solicita un reporte con rango de fechas, estado de cita y otros filtros
- **THEN** el sistema consulta la base de datos, aplica los filtros y muestra el reporte con totales y detalles

### Requirement: Exportar reportes
El sistema SHALL permitir exportar los reportes generados a formatos PDF o Excel.

#### Scenario: Exportación a PDF
- **WHEN** el psicólogo/a selecciona exportar un reporte a PDF
- **THEN** el sistema genera el archivo manteniendo el formato y lo pone disponible para descarga

#### Scenario: Exportación a Excel
- **WHEN** el psicólogo/a selecciona exportar un reporte a Excel
- **THEN** el sistema genera la hoja de cálculo con los datos filtrados y la pone disponible para descarga
