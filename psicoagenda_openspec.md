# Documentación Maestra del Proyecto: PsicoAgenda

## 1. Visión General
PsicoAgenda es un sistema orientado a profesionistas de la psicología que tiene como propósito facilitar la gestión integral de la práctica clínica, desde la programación de citas hasta el seguimiento de cada proceso terapéutico[cite: 2]. Actualmente, muchos consultorios trabajan con agendas en papel y mensajes dispersos, por lo que este sistema busca automatizar procesos, garantizar la confidencialidad y mejorar la comunicación profesional-paciente[cite: 2].

## 2. Alcance y Delimitaciones
* **Incluye:** Gestión de citas, historiales clínicos psicológicos individuales, recordatorios de pacientes (vía WhatsApp) y roles de usuario[cite: 2].
* **Excluye:** Módulos de facturación, videollamadas y expedientes médicos interdisciplinarios[cite: 2].
* **Plataformas:** Aplicación multiplataforma compatible con Windows, Android y cualquier navegador moderno[cite: 3].

## 3. Actores del Sistema
1. **Psicólogo/a (Primario):** Usuario principal que centraliza la gestión clínica mediante el control de la agenda, revisión de historiales, captura de notas de sesión y generación de reportes[cite: 2].
2. **Paciente (Primario):** Usuario con autonomía para gestionar su propio calendario (solicitar, modificar o cancelar citas), recibir recordatorios y visualizar información autorizada[cite: 2].
3. **Sistema PsicoAgenda (Secundario):** Administra de forma automática la agenda, resguarda historiales y ejecuta el envío de notificaciones y recordatorios[cite: 2].

## 4. Módulos y Casos de Uso Principales (Requisitos Funcionales)
* **Gestión de Usuarios:** Registro de pacientes y psicólogos, autenticación cifrada, recuperación de contraseñas, asignación de roles y edición de perfiles[cite: 3].
* **Gestión de Citas:** Programar, modificar y cancelar citas; consultar la agenda digital (calendario), verificar disponibilidad para evitar empalmes y registrar la asistencia de los pacientes[cite: 3].
* **Gestión de Notificaciones:** Envío de recordatorios automáticos (24 horas antes de la cita vía WhatsApp), confirmación de asistencia y notificaciones ante cualquier cambio de horario[cite: 3].
* **Gestión de Historial Clínico:** Generar entradas en bitácora por sesión, guardar notas clínicas, editar entradas manteniendo el registro de modificaciones, y visualizar el historial completo con antecedentes[cite: 3].
* **Gestión de Reportes:** Generar reportes estadísticos sobre el número de consultas, distribución temporal, tasas de asistencia/cancelación y exportación de estos a formatos PDF o Excel[cite: 3].

## 5. Requisitos No Funcionales (RNF)
* **Rendimiento:** Las operaciones del sistema deben ejecutarse en menos de 3 segundos[cite: 3].
* **Escalabilidad:** El sistema debe soportar un mínimo de 500 pacientes y 1000 citas de manera fluida[cite: 3].
* **Seguridad:** Los datos deben estar cifrados en tránsito y almacenamiento; debe haber un control estricto de sesiones (tiempo límite e intentos fallidos)[cite: 3].
* **Privacidad:** Estricto cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México)[cite: 3].
* **Infraestructura:** La información debe estar respaldada en servidores de AWS[cite: 2].

## 6. Requisitos de Dominio (RD)
* **Atención Clínica:** Las citas deben registrarse con duraciones estándar de entre 45 y 60 minutos[cite: 3].
* **Menores de Edad:** Para pacientes menores, el sistema debe permitir asociar la cuenta y el consentimiento informado a un tutor legal[cite: 3].
* **Confidencialidad Ética:** La información clínica debe apegarse al código de conducta de la APA y requerir registro del consentimiento informado[cite: 3].
* **Emergencias:** El expediente debe incluir obligatoriamente un campo para un contacto de emergencia[cite: 3].
* **Retención de Datos:** El sistema debe cumplir con la normativa legal de conservación de expedientes incluso si el paciente es inactivo, y permitir la portabilidad (exportación) si el paciente lo solicita[cite: 3].

## 7. Modelo de Dominio (Entidades de Base de Datos)
El sistema se compone de las siguientes clases/entidades principales[cite: 5]:
1. **Usuario:** `idUsuario`, `nombre`, `correo`, `contrasena`, `telefono`, `fechaRegistro`, `estado`.
2. **Psicólogo (hereda de Usuario):** `cedulaProfesional`, `especialidad`, `bio`.
3. **Paciente (hereda de Usuario):** `fechaNacimiento`, `genero`, `direccion`, `contactoEmergencia`.
4. **Cita:** `idCita`, `fechaHora`, `duracionMin`, `motivo`, `estado` (Pendiente/Confirmada/Cancelada/Atendida), `observaciones`, `modalidad`.
5. **HistorialClinico:** `idHistorial`, `fechaApertura`, `diagnostico`, `antecedentes`, `observacionesGenerales`, `estado`.
6. **Notificación:** `idNotificacion`, `asunto`, `mensaje`, `fechaEnvio`, `estado`, `canal`.
7. **Reporte:** `idReporte`, `tipo`, `fechaInicio`, `fechaFin`, `fechaGeneracion`, `formato`.