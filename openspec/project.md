# PsicoAgenda — Contexto del Proyecto

## Visión

PsicoAgenda es un sistema orientado a profesionistas de la psicología que facilita la gestión integral de la práctica clínica: programación de citas, historiales clínicos psicológicos, recordatorios automáticos (WhatsApp) y roles de usuario. Busca automatizar procesos, garantizar la confidencialidad y mejorar la comunicación profesional-paciente, sustituyendo agendas en papel y mensajes dispersos.

## Alcance

**Incluye:**
- Gestión de citas y agenda digital.
- Historiales clínicos psicológicos individuales.
- Recordatorios para pacientes vía WhatsApp.
- Roles de usuario (psicólogo/a, paciente).

**Excluye:**
- Módulos de facturación.
- Videollamadas.
- Expedientes médicos interdisciplinarios.

**Plataformas:** Aplicación multiplataforma compatible con Windows, Android y cualquier navegador moderno.

## Actores del Sistema

1. **Psicólogo/a (Primario):** Controla la agenda, revisa historiales, captura notas de sesión y genera reportes.
2. **Paciente (Primario):** Gestiona su propio calendario (solicitar, modificar o cancelar citas), recibe recordatorios y visualiza información autorizada.
3. **Sistema PsicoAgenda (Secundario):** Administra de forma automática la agenda, resguarda historiales y ejecuta el envío de notificaciones y recordatorios.

## Requisitos No Funcionales (RNF)

- **RNF_US_001 — Rendimiento:** Tiempo de respuesta en operaciones inferior a 3 segundos.
- **RNF_US_002 — Escalabilidad:** Soporte fluido de mínimo 500 pacientes y 1000 citas.
- **RNF_US_003 — Seguridad:** Datos cifrados en tránsito y almacenamiento.
- **RNF_US_004 — Sesiones:** Control de sesiones con tiempo máximo de inactividad y límite de intentos fallidos.
- **RNF_US_005 — Usabilidad:** Interfaz intuitiva y adaptable (multiplataforma: Windows, Android, navegadores modernos).
- **RNF_US_007 — Privacidad:** Cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México).
- **RNF_US_009 — Disponibilidad:** Alta disponibilidad del 99% durante el horario laboral.
- **Infraestructura:** Respaldo de información en servidores de AWS.

## Seguridad Adicional

- Cifrado de contraseñas y **autenticación en dos pasos (2FA)**.
- Resguardo protegido de historiales clínicos.

## Requisitos de Dominio (RD)

- **RD-01 / RD-02:** Terminología clínica adaptada y confidencialidad ética legal obligatoria (código de conducta APA) con registro de consentimiento informado.
- **RD-06:** Citas con duraciones estándar de 45 a 60 minutos.
- **RD-09 / RD-13:** Retención legal de expedientes (incluso con pacientes inactivos) y portabilidad de datos (exportación a PDF) a solicitud del paciente.
- **RD-11:** Pacientes menores: asociar cuenta y consentimiento informado a un tutor legal.
- Campo obligatorio de contacto de emergencia en el expediente.

## Stack Tecnológico

| Capa | Elección |
|------|----------|
| **Frontend web** | Next.js (React + TypeScript) |
| **Frontend móvil** | Expo / React Native (comparte tipos y lógica) |
| **Backend (BaaS)** | **Supabase** self-hosted sobre AWS |
| **Base de datos** | PostgreSQL (AWS RDS/Aurora) vía Supabase |
| **Autenticación / seguridad** | Supabase Auth (2FA, sesiones, Row Level Security para roles: psicólogo/paciente/tutor) |
| **Notificaciones (WhatsApp/Correo)** | Twilio (WhatsApp) + Amazon SES (correo) |
| **Infraestructura** | Supabase self-host en AWS (ECS/Fargate + RDS PostgreSQL + S3 con cifrado) |
| **Reportes / exportación** | Edge functions de Supabase (pdfkit para PDF, exceljs para Excel) |

## Decisiones de Arquitectura

- **PostgreSQL + Row Level Security:** la elección de Supabase (PostgreSQL) permite permisos por fila según rol (psicólogo, paciente, tutor legal), requisito clave para la confidencialidad clínica y el cumplimiento de la LFPDPPP.
- **Supabase self-hosted en AWS:** despliegue en la propia infraestructura AWS (ECS/Fargate + RDS PostgreSQL + S3 con cifrado) para satisfacer el requisito de "respaldo en AWS" con control total sobre los datos clínicos.
- **Autenticación con 2FA y control de sesiones:** Supabase Auth cubre RNF_US_003 (cifrado), RNF_US_004 (tiempo de inactividad e intentos fallidos) y admite 2FA.
- **Multiplataforma:** Next.js para web (Windows/navegadores) y Expo/React Native para Android, compartiendo tipos y lógica de negocio.
- **Disponibilidad 99%:** despliegue multi-AZ (ECS/Fargate + RDS) en horario laboral, alineado con RNF_US_009.
- **Notificaciones:** Twilio unifica WhatsApp y correo; Amazon SES se usa como canal de correo nativo de AWS.
- **Reportes portables:** edge functions generan exportaciones a PDF (pdfkit) y Excel (exceljs), cumpliendo RD-09/RD-13 (portabilidad).


## Convenciones del proyecto

- El documento maestro plano `psicoagenda_openspec.md` se conserva en la raíz como referencia histórica. La fuente de verdad a partir de ahora son los archivos bajo `openspec/`.
- Los specs actuales viven en `openspec/specs/<capability>/spec.md`.
- Los cambios propuestos se gestionan bajo `openspec/changes/` usando el flujo propose → apply → archive.
- Los artefactos de OpenSpec se escriben en español (cabeceras estructurales y palabras clave SHALL/MUST en inglés, según configuración).
