# Proyecto: PsicoAgenda

## Visión

PsicoAgenda es un sistema orientado a profesionistas de la psicología que tiene como propósito facilitar la gestión integral de la práctica clínica, desde la programación de citas hasta el seguimiento de cada proceso terapéutico. Busca automatizar procesos, garantizar la confidencialidad y mejorar la comunicación profesional-paciente.

## Alcance

### Incluye
- Registro y administración de usuarios (psicólogos/as y pacientes).
- Gestión de citas mediante agenda digital.
- Envío de recordatorios automáticos a pacientes vía WhatsApp y correo electrónico.
- Módulo de historial clínico y bitácora por sesión.
- Generación de reportes operativos exportables a PDF y Excel.
- Gestión de roles y permisos.
- Control de seguridad, privacidad y cumplimiento normativo.

### Excluye
- Módulos de facturación electrónica o contabilidad.
- Videollamadas integradas.
- Expedientes médicos interdisciplinarios.

### Plataformas
Aplicación multiplataforma compatible con Windows, Android y cualquier navegador moderno.

## Actores

1. **Psicólogo/a (Primario):** Usuario principal que centraliza la gestión clínica mediante el control de la agenda, revisión de historiales, captura de notas de sesión y generación de reportes.
2. **Paciente (Primario):** Usuario con autonomía para gestionar su propio calendario (solicitar, modificar o cancelar citas), recibir recordatorios y visualizar información autorizada.
3. **Sistema PsicoAgenda (Secundario):** Administra de forma automática la agenda, resguarda historiales y ejecuta el envío de notificaciones y recordatorios.

## Requisitos No Funcionales

| Código | Categoría | Descripción |
|---|---|---|
| RNF_US_001 | Rendimiento | Operaciones en menos de 3 segundos |
| RNF_US_002 | Rendimiento | Soporte mínimo de 500 pacientes y 1000 citas |
| RNF_US_003 | Seguridad | Datos cifrados en tránsito y almacenamiento |
| RNF_US_004 | Seguridad | Control de sesión (tiempo e intentos fallidos) |
| RNF_US_005 | Usabilidad | Interfaz intuitiva y fácil de usar |
| RNF_US_006 | Compatibilidad | Compatibilidad con navegadores modernos |
| RNF_US_007 | Privacidad | Cumplimiento con la Ley de Protección de Datos |
| RNF_US_008 | Eficiencia | Consumo optimizado de recursos |
| RNF_US_009 | Escalabilidad | Crecimiento de usuarios y del sistema |

## Requisitos de Dominio

| Código | Categoría | Descripción |
|---|---|---|
| RD-01 | Estándares y confidencialidad | Terminología psicológica en campos de registro |
| RD-02 | Estándares y confidencialidad | Confidencialidad profesional |
| RD-03 | Gestión clínica y seguimiento | Registro de sesiones clínicas |
| RD-04 | Estándares y confidencialidad | Comunicación profesional-paciente |
| RD-05 | Estándares y confidencialidad | Cumplimiento institucional |
| RD-06 | Gestión de agenda y citas | Tiempos de atención estándar (45–60 min) |
| RD-07 | Gestión de agenda y citas | Integración con agenda profesional |
| RD-08 | Gestión clínica y seguimiento | Control de seguimiento del paciente |
| RD-09 | Estándares y confidencialidad | Retención de expedientes |
| RD-10 | Estándares y confidencialidad | Consentimiento informado |
| RD-11 | Estándares y confidencialidad | Manejo de pacientes menores de edad |
| RD-12 | Gestión clínica y seguimiento | Datos de contacto de emergencia |
| RD-13 | Gestión clínica y seguimiento | Portabilidad de datos del paciente |
| RD-14 | Gestión de agenda y citas | Estado de pago de honorarios (pendiente/pagado) sin facturación electrónica |

## Modelo de Dominio

Entidades principales:

- **Usuario:** `idUsuario`, `nombre`, `correo`, `contrasena`, `telefono`, `fechaRegistro`, `estado`.
- **Psicólogo/a:** `cedulaProfesional`, `especialidad`, `bio`.
- **Paciente:** `fechaNacimiento`, `genero`, `direccion`, `contactoEmergencia`.
- **Cita:** `idCita`, `fechaHora`, `duracionMin`, `motivo`, `estado`, `observaciones`, `modalidad`.
- **HistorialClinico:** `idHistorial`, `fechaApertura`, `diagnostico`, `antecedentes`, `observacionesGenerales`, `estado`.
- **EntradaBitacora:** `idEntrada`, `idCita`, `fechaHora`, `notasSesion`, `profesionalId`, `version`.
- **ConsentimientoInformado:** `idConsentimiento`, `idPaciente`, `fechaFirma`, `documento`, `tutorLegalId`.
- **Notificacion:** `idNotificacion`, `asunto`, `mensaje`, `fechaEnvio`, `estado`, `canal`.
- **Reporte:** `idReporte`, `tipo`, `fechaInicio`, `fechaFin`, `fechaGeneracion`, `formato`.
- **PagoHonorario:** `idPago`, `idCita`, `monto`, `estado`, `fechaPago`.

## Restricciones

- Conectividad a internet para mensajes y recordatorios.
- Almacenamiento conforme a la Ley de Protección de Datos.
- Compatibilidad con navegadores modernos y WhatsApp API.

## Dependencias

- API de WhatsApp Business.
- Servidor o hosting para base de datos y aplicaciones web.
