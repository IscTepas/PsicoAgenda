# Documentación Maestra del Proyecto: PsicoAgenda

> Documento maestro plano del proyecto PsicoAgenda. Este archivo es la referencia histórica y de alto nivel derivada del ERS formal `PSICOAGENDA_RP33_ERS.docx`. La fuente de verdad formal para el desarrollo vive bajo `openspec/`.

---

## 1. Visión General

PsicoAgenda es un sistema orientado a profesionistas de la psicología que tiene como propósito facilitar la gestión integral de la práctica clínica, desde la programación de citas hasta el seguimiento de cada proceso terapéutico. Actualmente, muchos consultorios trabajan con agendas en papel, hojas de cálculo y mensajes dispersos en WhatsApp, lo que genera citas duplicadas o pérdidas, dificultad para localizar historiales clínicos actualizados y riesgos en la confidencialidad de la información. El objetivo principal del sistema es automatizar estos procesos y ofrecer una herramienta digital que permita almacenar, consultar y gestionar la información de forma organizada, rápida y segura.

El acceso al sistema se realizará mediante una pantalla de inicio de sesión, donde cada usuario ingresará con un correo y una contraseña previamente registrados. A partir de sus credenciales, PsicoAgenda identificará el rol y mostrará las funciones correspondientes.

PsicoAgenda incorporará medidas de seguridad acordes con la naturaleza confidencial de la información psicológica: contraseñas cifradas, control de acceso por rol, registro de acciones relevantes y resguardo de historiales clínicos en un entorno protegido. Además, contará con una interfaz clara e intuitiva, tanto en la versión web como en la móvil, para reducir errores en la captura de datos y permitir que la información esté disponible de inmediato y de forma confiable durante las consultas.

---

## 2. Alcance y Delimitaciones

**Incluye:**
- Registro y administración de usuarios (psicólogos/as y pacientes).
- Gestión de citas mediante agenda digital.
- Envío de recordatorios automáticos a pacientes vía WhatsApp y correo electrónico.
- Módulo de historial clínico y bitácora por sesión.
- Generación de reportes operativos exportables a PDF y Excel.
- Gestión de roles y permisos.
- Control de seguridad, privacidad y cumplimiento normativo.

**Excluye:**
- Módulos de facturación electrónica o contabilidad.
- Videollamadas integradas.
- Expedientes médicos interdisciplinarios.

**Plataformas:** Aplicación multiplataforma compatible con Windows, Android y cualquier navegador moderno.

---

## 3. Definiciones, Acrónimos y Abreviaturas

| Término | Definición |
|---|---|
| **RF** | Requisitos Funcionales |
| **RNF** | Requisitos No Funcionales |
| **RD** | Requisitos de Dominio |
| **SMS** | Servicio de Mensajes Cortos |
| **OS** | Sistema Operativo |
| **API** | Conjunto de funciones que permiten la comunicación entre aplicaciones (por ejemplo, WhatsApp y PsicoAgenda) |
| **ERS** | Especificación de Requerimientos de Software |
| **2FA** | Autenticación de dos factores |
| **LFPDPPP** | Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México) |
| **APA** | American Psychological Association |

---

## 4. Referencias

| # | Título | Número / Código | Fecha |
|---|---|---|---|
| 1 | IEEE Guide for Software Requirements Specifications | IEEE Std 830-1998 | 1998 |
| 2 | Object Management Group. Unified Modeling Language Specification Version 1.4 | formal/2001-09-67 | 2001 |
| 3 | Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México) | Diario Oficial de la Federación | 2010 |
| 4 | American Psychological Association. Ethical Principles of Psychologists and Code of Conduct | APA Code 2017 | 2017 |
| 5 | Organización Mundial de la Salud (OMS). Principios de confidencialidad y ética profesional en salud mental | OMS/WHO/MentalHealth-Conf/2020 | 2020 |

---

## 5. Actores del Sistema

1. **Psicólogo/a (Primario):** Usuario principal que centraliza la gestión clínica mediante el control de la agenda, revisión de historiales, captura de notas de sesión y generación de reportes.
2. **Paciente (Primario):** Usuario con autonomía para gestionar su propio calendario (solicitar, modificar o cancelar citas), recibir recordatorios y visualizar información autorizada.
3. **Sistema PsicoAgenda (Secundario):** Administra de forma automática la agenda, resguarda historiales y ejecuta el envío de notificaciones y recordatorios.

---

## 6. Módulos y Casos de Uso Principales

### 6.1 Gestión de Usuarios
- Registrar usuario.
- Actualizar usuario.
- Eliminar usuario.
- Consultar usuario.
- Gestionar perfil de usuario.
- Recuperación de contraseña.
- Autenticación.
- Asignación de roles y permisos.

### 6.2 Gestión de Citas
- Programar cita.
- Modificar cita.
- Cancelar cita.
- Consultar cita.
- Consultar agenda.
- Verificar disponibilidad.
- Registrar asistencia.

### 6.3 Gestión de Notificaciones
- Enviar recordatorios automáticos.
- Confirmación de asistencia.
- Notificación de cambios.
- Programar envío de recordatorios.

### 6.4 Gestión de Historial Clínico
- Agregar entrada de bitácora.
- Guardar entrada de bitácora.
- Editar entrada de bitácora.
- Consultar historial clínico.

### 6.5 Gestión de Reportes
- Generar reporte de citas.
- Filtrar datos.
- Exportar reportes.

---

## 7. Requisitos Funcionales

### 7.1 Tabla resumen por actor

| Actor | Código | Requisito Funcional |
|---|---|---|
| Paciente | RF_US_001 | Autenticar |
| Paciente | RF_US_002 | Solicitud de Cita |
| Paciente | RF_US_003 | Actualizar Información Personal |
| Paciente | RF_US_004 | Registrar Usuarios |
| Paciente | RF_US_005 | Confirmar Cita |
| Paciente | RF_US_006 | Cancelar Cita |
| Paciente | RF_US_007 | Consultar Agenda Digital |
| Paciente | RF_US_008 | Visualizar Próximas Citas |
| Paciente | RF_US_009 | Solicitar Reagendar Cita |
| Psicólogo/a | RF_US_010 | Autenticar |
| Psicólogo/a | RF_US_011 | Gestión de Perfil de Usuario |
| Psicólogo/a | RF_US_012 | Registro de Paciente |
| Psicólogo/a | RF_US_013 | Editar Bitácora de Paciente |
| Psicólogo/a | RF_US_014 | Buscar Paciente |
| Psicólogo/a | RF_US_015 | Programar Cita |
| Psicólogo/a | RF_US_016 | Modificar Cita |
| Psicólogo/a | RF_US_017 | Cancelar Cita |
| Psicólogo/a | RF_US_018 | Consultar Agenda Digital |
| Psicólogo/a | RF_US_019 | Generar Reportes de Citas |
| Psicólogo/a | RF_US_020 | Ver Historial Clínico |
| Psicólogo/a | RF_US_021 | Guardar Entrada de Bitácora |
| Sistema PsicoAgenda | RF_US_022 | Validación de Datos |
| Sistema PsicoAgenda | RF_US_023 | Control de Roles y Permisos |
| Sistema PsicoAgenda | RF_US_024 | Control de Sesiones |
| Sistema PsicoAgenda | RF_US_025 | Gestión de Citas |
| Sistema PsicoAgenda | RF_US_026 | Gestión de Notificaciones |
| Sistema PsicoAgenda | RF_US_027 | Gestión de Bases de Datos |
| Sistema PsicoAgenda | RF_US_028 | Restauración de Contraseñas |

> **Nota sobre numeración:** esta numeración corrige inconsistencias detectadas en el documento `.docx` original (códigos duplicados y conflictivos).

### 7.2 Especificación detallada

#### RF_US_001 — Autenticar (Paciente)
- **Descripción:** Permite el acceso al sistema validando credenciales.
- **Entrada de Datos:** Usuario, contraseña.
- **Proceso:** Con los datos ingresados se validan las credenciales y el rol, comprobando que el usuario y la contraseña existan en el sistema.
- **Salida:** Si el sistema encuentra al usuario, envía un mensaje de autenticación exitosa; de lo contrario, muestra una alerta: "Usuario y/o contraseña inválidos".
- **RNF asociados:** RNF_US_003, RNF_US_004, RNF_US_007.

#### RF_US_002 — Solicitud de Cita (Paciente)
- **Descripción:** Solicita una cita con un psicólogo/a disponible.
- **Entrada de Datos:** Fecha, motivo, psicólogo/a.
- **Proceso:** Se verifica la disponibilidad y se registra la solicitud en estado "Pendiente de Aprobación".
- **Salida:** La solicitud se registra exitosamente con un aviso al paciente y notificación al psicólogo/a asignado.
- **RNF asociados:** RNF_US_001, RNF_US_004.

#### RF_US_003 — Actualizar Información Personal (Paciente)
- **Descripción:** Permite consultar y actualizar su información personal.
- **Entrada de Datos:** Datos del perfil.
- **Proceso:** Se valida el formato, se cambian los campos permitidos y se guardan los nuevos datos en la base de datos manteniendo integridad.
- **Salida:** El perfil se actualiza correctamente con un mensaje de confirmación o errores específicos.
- **RNF asociados:** RNF_US_004, RNF_US_005.

#### RF_US_004 — Registrar Usuarios (Paciente)
- **Descripción:** Permite que nuevos pacientes creen una cuenta en el sistema proporcionando datos básicos.
- **Entrada de Datos:** Nombre, correo electrónico, contraseña, tipo de usuario.
- **Proceso:** Validación de datos, verificación del correo y almacenamiento en la base de datos.
- **Salida:** Cuenta creada junto con un mensaje de confirmación.
- **RNF asociados:** RNF_US_003, tiempo de espera menor a 2 s, contraseña cifrada con algoritmo seguro.

#### RF_US_005 — Confirmar Cita (Paciente)
- **Descripción:** Confirma una cita previamente programada en el sistema.
- **Entrada de Datos:** ID Cita.
- **Proceso:** Se identifica la cita, se cambia a estado "Confirmada" y se registra el evento para auditoría.
- **Salida:** La cita queda confirmada y se envía una notificación al psicólogo/a de turno.
- **RNF asociados:** RNF_US_003, RNF_US_007.

#### RF_US_006 — Cancelar Cita (Paciente)
- **Descripción:** Cancelar una cita vigente ingresada con anterioridad.
- **Entrada de Datos:** ID Cita.
- **Proceso:** Se actualiza la cita a estado "Cancelada", se guarda la fecha de cancelación y se notifica al psicólogo/a.
- **Salida:** Confirmación de cancelación en la interfaz y notificación al profesional.
- **RNF asociados:** RNF_US_002, RNF_US_004.

#### RF_US_007 — Consultar Agenda Digital (Paciente)
- **Descripción:** Visualizar el calendario de citas programadas.
- **Entrada de Datos:** ID Paciente.
- **Proceso:** Se consultan las citas del usuario, se organizan por fecha y hora y se muestra un calendario digital en pantalla.
- **Salida:** La interfaz se visualiza como una agenda con indicadores de estado por cita.
- **RNF asociados:** RNF_US_001, RNF_US_005.

#### RF_US_008 — Visualizar Próximas Citas (Paciente)
- **Descripción:** Filtrar y visualizar únicamente las citas futuras.
- **Entrada de Datos:** ID Usuario.
- **Proceso:** Se filtran todas las citas mayores a la fecha actual y se genera un listado resumido.
- **Salida:** Lista de próximas citas con datos necesarios (fecha, hora y estado).
- **RNF asociados:** RNF_US_001, RNF_US_005.

#### RF_US_009 — Solicitar Reagendar Cita (Paciente)
- **Descripción:** Solicitar un cambio de fecha y hora en una cita programada.
- **Entrada de Datos:** Nueva fecha, nueva hora.
- **Proceso:** Se valida la disponibilidad, se reasigna el estado a "Solicitud de Reagendar" y se notifica al psicólogo/a.
- **Salida:** Solicitud registrada y notificación enviada.
- **RNF asociados:** RNF_US_001, RNF_US_004.

#### RF_US_010 — Autenticar (Psicólogo/a)
- **Descripción:** Permite el acceso al sistema validando credenciales.
- **Entrada de Datos:** Usuario, contraseña.
- **Proceso:** Validación de credenciales y rol.
- **Salida:** Mensaje de autenticación exitosa o alerta de credenciales inválidas.
- **RNF asociados:** RNF_US_003, RNF_US_004, RNF_US_007.

#### RF_US_011 — Gestión de Perfil de Usuario (Psicólogo/a)
- **Descripción:** Permite consultar y actualizar información personal.
- **Entrada de Datos:** Datos del perfil.
- **Proceso:** Validación de formato, cambio de campos permitidos y guardado en base de datos.
- **Salida:** Perfil actualizado correctamente o errores específicos.
- **RNF asociados:** RNF_US_004, RNF_US_005.

#### RF_US_012 — Registro de Paciente (Psicólogo/a)
- **Descripción:** Registrar un nuevo paciente en el sistema.
- **Entrada de Datos:** Datos del paciente.
- **Proceso:** Validación de datos obligatorios, verificación de duplicados, generación de expediente único con cifrado de datos sensibles y guardado en base de datos.
- **Salida:** Registro exitoso del paciente y visualización inmediata del expediente clínico inicial.
- **RNF asociados:** RNF_US_003, RNF_US_008.

#### RF_US_013 — Editar Bitácora de Paciente (Psicólogo/a)
- **Descripción:** Registra información clínica de las sesiones con cada paciente.
- **Entrada de Datos:** Información clínica.
- **Proceso:** Se garantiza trazabilidad agregando fecha, hora y usuario responsable; se guardan varias versiones modificadas para auditoría.
- **Salida:** La bitácora se actualiza correctamente y se confirma la modificación exitosa.
- **RNF asociados:** RNF_US_004, RNF_US_007.

#### RF_US_014 — Buscar Paciente (Psicólogo/a)
- **Descripción:** Buscar el historial del paciente mediante filtros individuales.
- **Entrada de Datos:** Nombre, ID Paciente.
- **Proceso:** Se consultan registros aplicando filtros y se ordenan los resultados según coincidencias.
- **Salida:** Listado de coincidencias con accesos directos a expedientes.
- **RNF asociados:** RNF_US_001, RNF_US_003.

#### RF_US_015 — Programar Cita (Psicólogo/a)
- **Descripción:** Permite asignar fecha, hora y paciente en la creación de una nueva cita.
- **Entrada de Datos:** Fecha, hora, datos de la cita.
- **Proceso:** Se consulta disponibilidad, se registra la cita y se generan notificaciones automáticas para el paciente.
- **Salida:** Confirmación de cita programada y reflejo en la agenda virtual.
- **RNF asociados:** RNF_US_001, RNF_US_002.

#### RF_US_016 — Modificar Cita (Psicólogo/a)
- **Descripción:** Permite modificar fecha y hora de una cita creada y programada.
- **Entrada de Datos:** Nueva fecha, nueva hora.
- **Proceso:** Se actualiza la cita si hay disponibilidad, se reprograman notificaciones y se registran las modificaciones.
- **Salida:** Cita actualizada y alerta enviada al paciente.
- **RNF asociados:** RNF_US_001, RNF_US_004.

#### RF_US_017 — Cancelar Cita (Psicólogo/a)
- **Descripción:** Cancelar una cita vigente ingresada con anterioridad.
- **Entrada de Datos:** ID Cita.
- **Proceso:** Se actualiza la cita a estado "Cancelada", se guarda la fecha de cancelación y se notifica al paciente.
- **Salida:** Confirmación de cancelación en la interfaz y notificación al paciente.
- **RNF asociados:** RNF_US_002, RNF_US_004.

#### RF_US_018 — Consultar Agenda Digital (Psicólogo/a)
- **Descripción:** Visualizar el calendario de citas programadas.
- **Entrada de Datos:** ID Psicólogo/a.
- **Proceso:** Se recuperan las citas programadas, se organizan mediante filtros (día, semana, mes) y se muestran los estados de todas las citas.
- **Salida:** Agenda actualizada con acciones rápidas por cita.
- **RNF asociados:** RNF_US_001, RNF_US_005.

#### RF_US_019 — Generar Reportes de Citas (Psicólogo/a)
- **Descripción:** Generar y crear reportes de las citas atendidas.
- **Entrada de Datos:** Filtros de reporte.
- **Proceso:** Se filtra la información, se generan archivos descargables y se almacenan registros del evento.
- **Salida:** Reporte visual y descargable en formato PDF y Excel.
- **RNF asociados:** RNF_US_002, RNF_US_008.

#### RF_US_020 — Ver Historial Clínico (Psicólogo/a)
- **Descripción:** Muestra el historial clínico completo del paciente.
- **Entrada de Datos:** ID Paciente y filtros opcionales.
- **Proceso:** Recuperar datos maestros del paciente, registros de historial, sesiones y documentos; aplicar filtros y organizar en secciones.
- **Salida:** Historial clínico mostrado en pantalla con navegación por secciones.
- **RNF asociados:** RNF_US_003, RNF_US_005, RNF_US_007.

#### RF_US_021 — Guardar Entrada de Bitácora (Psicólogo/a)
- **Descripción:** Registrar en la base de datos los datos clínicos agregados en un formulario.
- **Entrada de Datos:** ID Paciente y datos clínicos.
- **Proceso:** Validar campos obligatorios, guardar información en tablas de historial clínico, registrar fecha, hora y profesional que capturó.
- **Salida:** Historial registrado y mensaje de confirmación.
- **RNF asociados:** RNF_US_004, RNF_US_007.

#### RF_US_022 — Validación de Datos (Sistema)
- **Descripción:** Evita datos incorrectos o vacíos en campos obligatorios.
- **Entrada de Datos:** Datos a guardar.
- **Proceso:** El sistema analiza los campos, verifica reglas de formato, detecta valores incompletos o inválidos y confirma coherencia con registros existentes.
- **Salida:** Validación exitosa o mensajes de error específicos.
- **RNF asociados:** RNF_US_003, RNF_US_004.

#### RF_US_023 — Control de Roles y Permisos (Sistema)
- **Descripción:** Restringe funciones del sistema según el rol del usuario.
- **Entrada de Datos:** ID (Paciente, Psicólogo/a).
- **Proceso:** El sistema identifica el rol, consulta permisos, habilita la interfaz correspondiente y bloquea funciones no permitidas.
- **Salida:** Vista personalizada con opciones visibles solo para el rol del usuario.
- **RNF asociados:** RNF_US_003.

#### RF_US_024 — Control de Sesiones (Sistema)
- **Descripción:** Maneja el inicio y cierre automático del sistema.
- **Entrada de Datos:** Inicio de sesión, cierre de sesión.
- **Proceso:** El sistema crea una sesión única y cifrada, registra hora de actividad, controla tiempo de inactividad y finaliza la sesión por expiración.
- **Salida:** Sesión activa segura o cierre automático por expiración.
- **RNF asociados:** RNF_US_003, RNF_US_004.

#### RF_US_025 — Gestión de Citas (Sistema)
- **Descripción:** Permite administrar el estado de cada cita ingresada.
- **Entrada de Datos:** Solicitud, aceptar, cancelar.
- **Proceso:** El sistema verifica disponibilidad, registra el estado correspondiente, sincroniza en tiempo real y almacena la acción.
- **Salida:** Estado de la cita visible actualizado en las agendas de los usuarios involucrados.
- **RNF asociados:** RNF_US_001, RNF_US_007.

#### RF_US_026 — Gestión de Notificaciones (Sistema)
- **Descripción:** Alerta de cualquier cambio realizado en citas.
- **Entrada de Datos:** Cambio de estado de cita.
- **Proceso:** El sistema identifica el receptor, genera la notificación interna, la almacena con sello de tiempo y la despliega en el módulo de avisos.
- **Salida:** Notificación mostrada correctamente con registro de lectura.
- **RNF asociados:** RNF_US_001, RNF_US_003.

#### RF_US_027 — Gestión de Bases de Datos (Sistema)
- **Descripción:** Almacenar y recuperar información del sistema.
- **Entrada de Datos:** Datos del sistema.
- **Proceso:** El sistema ejecuta la operación solicitada, valida integridad referencial y controla que los cambios se apliquen correctamente.
- **Salida:** Base de datos actualizada correctamente o error controlado.
- **RNF asociados:** RNF_US_003, RNF_US_008.

#### RF_US_028 — Restauración de Contraseñas (Sistema)
- **Descripción:** Permite recuperar la cuenta mediante restablecimiento seguro de contraseña.
- **Entrada de Datos:** Correo registrado.
- **Proceso:** El sistema confirma identidad, genera una clave temporal o enlace seguro y lo envía al usuario.
- **Salida:** Contraseña restablecida exitosamente o notificación con instrucciones adicionales.
- **RNF asociados:** RNF_US_003, RNF_US_006.

---

## 8. Requisitos No Funcionales

| Categoría | Código | Descripción |
|---|---|---|
| Rendimiento | RNF_US_001 | Operaciones en menos de 3 segundos |
| Rendimiento | RNF_US_002 | Soporte mínimo de 500 pacientes y 1000 citas |
| Seguridad | RNF_US_003 | Datos cifrados en tránsito y almacenamiento |
| Seguridad | RNF_US_004 | Control de sesión (tiempo e intentos fallidos) |
| Usabilidad | RNF_US_005 | Interfaz intuitiva y fácil de usar |
| Compatibilidad | RNF_US_006 | Compatibilidad con navegadores modernos |
| Privacidad | RNF_US_007 | Cumplimiento con la Ley de Protección de Datos |
| Eficiencia | RNF_US_008 | Consumo optimizado de recursos |
| Escalabilidad | RNF_US_009 | Crecimiento de usuarios y del sistema |

---

## 9. Requisitos de Dominio

### 9.1 Categorías y requisitos

#### Estándares y Confidencialidad
- **RD-01 Terminología psicológica:** Los campos de registro deben adaptarse a los términos y formatos utilizados en atención psicológica.
- **RD-02 Confidencialidad profesional:** La información clínica debe cumplir con los principios éticos y legales de confidencialidad del ejercicio psicológico.
- **RD-04 Comunicación profesional-paciente:** Los recordatorios y mensajes deben respetar un tono formal, ético y confidencial.
- **RD-05 Cumplimiento institucional:** El sistema debe alinearse con las políticas y normas de atención psicológica de la organización.
- **RD-09 Retención de expedientes:** El sistema debe adherirse a la normativa legal sobre el tiempo mínimo de conservación de expedientes clínicos, incluso si el paciente ya no está activo.
- **RD-10 Consentimiento informado:** El sistema debe permitir registrar que el paciente (o su tutor) ha otorgado su consentimiento informado para el tratamiento y el manejo de sus datos.
- **RD-11 Manejo de pacientes menores de edad:** En caso de pacientes menores de edad, el sistema debe permitir asociar la cuenta y el consentimiento a un tutor legal responsable, de acuerdo con la ley.

#### Gestión Clínica y Seguimiento
- **RD-03 Registro de sesiones clínicas:** Debe incluir la posibilidad de registrar observaciones o notas del psicólogo/a por sesión.
- **RD-08 Control de seguimiento:** Debe permitir monitorear la evolución y seguimiento de cada paciente a lo largo del tratamiento.
- **RD-12 Datos de contacto de emergencia:** El expediente del paciente debe incluir un campo obligatorio para un contacto de emergencia, como parte del protocolo estándar de admisión clínica.
- **RD-13 Portabilidad de datos del paciente:** De acuerdo con la Ley de Protección de Datos, el sistema debe facilitar la exportación del historial de citas y notas del paciente (ej. formato PDF) en caso de que este lo solicite.

#### Gestión de Agenda y Citas
- **RD-06 Tiempos de atención estándar:** Las citas deben registrarse con duraciones de entre 45 y 60 minutos según las prácticas clínicas habituales.
- **RD-07 Integración con agenda profesional:** La agenda digital debe reflejar la disponibilidad del psicólogo/a según sus horarios laborales.
- **RD-14 Estado de pago de honorarios:** Cada sesión (cita) registrada debe tener una asociación con el estado de pago de honorarios (pendiente, pagado) para el control administrativo del consultorio. **No constituye un módulo de facturación electrónica ni contabilidad.**

---

## 10. Restricciones, Supuestos y Dependencias

### 10.1 Restricciones

| Restricción | Descripción |
|---|---|
| Conectividad | Requiere acceso a internet para el envío de mensajes y recordatorios. |
| Privacidad | Los datos del paciente deben almacenarse conforme a la Ley de Protección de Datos. |
| Compatibilidad | El sistema debe ser compatible con navegadores modernos y WhatsApp API. |

### 10.2 Supuestos y dependencias

**Supuestos:**
- La psicóloga dispone de conexión estable a internet.
- Los pacientes utilizan WhatsApp como medio de comunicación principal.

**Dependencias:**
- API de WhatsApp Business.
- Servidor o hosting para base de datos y aplicaciones web.

---

## 11. Requisitos Futuros

- Implementación de videollamadas integradas dentro del sistema PsicoAgenda.
- Módulo de pagos en línea mediante transferencias bancarias.
- Aplicación móvil complementaria para pacientes.

---

## 12. Modelo de Dominio

El sistema se compone de las siguientes clases/entidades principales:

1. **Usuario:** `idUsuario`, `nombre`, `correo`, `contrasena`, `telefono`, `fechaRegistro`, `estado`.
2. **Psicólogo/a (hereda de Usuario):** `cedulaProfesional`, `especialidad`, `bio`.
3. **Paciente (hereda de Usuario):** `fechaNacimiento`, `genero`, `direccion`, `contactoEmergencia`.
4. **Cita:** `idCita`, `fechaHora`, `duracionMin`, `motivo`, `estado` (Pendiente/Confirmada/Cancelada/Atendida), `observaciones`, `modalidad`.
5. **HistorialClinico:** `idHistorial`, `fechaApertura`, `diagnostico`, `antecedentes`, `observacionesGenerales`, `estado`.
6. **Notificación:** `idNotificacion`, `asunto`, `mensaje`, `fechaEnvio`, `estado`, `canal`.
7. **Reporte:** `idReporte`, `tipo`, `fechaInicio`, `fechaFin`, `fechaGeneracion`, `formato`.
8. **EntradaBitacora:** `idEntrada`, `idCita`, `fechaHora`, `notasSesion`, `profesionalId`, `version`.
9. **ConsentimientoInformado:** `idConsentimiento`, `idPaciente`, `fechaFirma`, `documento`, `tutorLegalId` (opcional).
10. **PagoHonorario:** `idPago`, `idCita`, `monto`, `estado` (Pendiente/Pagado), `fechaPago` (opcional).

---

## 13. Características de los Usuarios

| Usuario | Casos de Uso | Tipo | Conocimiento | Actividad |
|---|---|---|---|---|
| Paciente | Agendar, consultar, modificar y eliminar citas | Directo | Uso básico de dispositivo móvil o computadora con internet | Agendar o cancelar citas fácilmente; consultar citas previas o futuras desde cualquier dispositivo. |
| Psicólogo/a | Registrar, editar y consultar pacientes e historiales; acceder a reportes | Directo | Uso básico de dispositivo móvil o computadora con internet | Registrar, editar y consultar pacientes y sus historiales clínicos; acceder a reportes de atención. |
| Sistema PsicoAgenda | Envío de notificaciones | Indirecto | Servicios de mensajería | Envío de notificaciones a ambos tipos de usuarios para recordar citas próximas. |
