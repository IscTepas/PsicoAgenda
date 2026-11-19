# Verificación de requisitos — PsicoAgenda

> **Fecha:** 2026-11-19
> **Rama analizada:** `Christian` (HEAD `85ea3eb` "ARREGLAR TODO")
> **Documentos verificados:** RP23 (BPMN), RP32 (Descripción del proyecto), RP33 (ERS)
> **Método:** extracción de texto de los 3 documentos + lectura de código + ejecución de `typecheck` y `test`. No se modificó ningún archivo del proyecto.

---

## 1. Resumen ejecutivo

| Área | Estado |
|---|---|
| Flujo BPMN (RP23) | 🟢 Cumplido |
| Citas, agenda y anti-empalmes | 🟢 Cumplido (el punto más fuerte) |
| Usuarios, login, roles y recuperación | 🟢 Cumplido |
| Historial clínico, consentimiento y tutores | 🟢 Cumplido |
| Honorarios / estado de pago (RD-14) | 🟢 Cumplido |
| Recordatorios WhatsApp 24 h | 🟢 Cumplido |
| Reportes PDF/Excel reales | 🟡 Solo CSV + imprimir |
| Confirmación en 1 clic desde WhatsApp | 🔴 Ausente |
| Recordatorios configurables 12/24/48 h | 🔴 Ausente |
| App nativa Windows/Android | 🔴 Ausente (solo PWA web) |
| RLS / auditoría / TLS estricto | 🔴/🟡 Insuficiente |
| **Compila y pasa tests** | 🔴 **No compila; 1 test falla** |

**Conclusión:** el sistema cubre el núcleo del proyecto (el BPMN y la mayoría de requisitos funcionales), pero **hoy no compila** por un cliente Prisma desactualizado, y faltan brechas concretas en reportes, notificaciones y seguridad.

---

## 2. Salud del proyecto (ejecutado)

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | ❌ **32 errores** en `apps/api/src/services/*` |
| `npm test` | ⚠️ 233 pasan, **1 falla real**, 30 omitidos; 4 archivos fallan por timeout de BD (no hay base accesible en el entorno) |

### Causa raíz del build roto
`apps/api/prisma/schema.prisma` **sí** define `tareas_sesion`, `tarifa_adulto`, `tarifa_menor`, `recargo_mismo_dia_pct`, `recargo_mismo_dia_monto`, `descuento_virtual`, `enlace_videollamada` y el enum `TAREA`. Pero el cliente generado en `apps/api/src/generated/prisma/` (fechado 08/11/2026) **no contiene ninguno** (0 coincidencias).

Errores por archivo:

| Archivo | Errores |
|---|---|
| `apps/api/src/services/psychologist.service.ts` | 14 |
| `apps/api/src/services/task.service.ts` | 14 |
| `apps/api/src/services/log-entry.service.ts` | 2 |
| `apps/api/src/services/appointment.service.ts` | 1 |
| `apps/api/src/services/notification.service.ts` | 1 |

**Solución:** ejecutar `npm run prisma:generate`. (No se hizo para no modificar el repo.)

### Falla funcional real de los tests
`tests/notification.service.test.ts` → *"con WhatsApp configurado entrega por la API con los datos del usuario"*:

```
Esperado: "Tu cita fue confirmada"
Recibido: "Mensaje"
```

La plantilla de WhatsApp envía un texto genérico donde el test espera el mensaje concreto del evento.

---

## 3. LO QUE YA TIENEN (implementado, con evidencia)

### 3.1 Stack

| Capa | Tecnología |
|---|---|
| API | Express 5 + TypeScript, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL/Supabase, Zod |
| Web | Next.js 16.3.6, React 19.2.8, Tailwind 4, shadcn, TanStack Query, `@supabase/ssr`, Serwist (PWA) |
| Shared | `packages/shared/src/schemas`, `packages/shared/src/types` |
| Monorepo | workspaces `apps/*`, `packages/*` |
| Despliegue | Vercel (`vercel.json`, región `iad1`, `maxDuration: 30`) |
| BD | 23 modelos, 13 enums, migraciones en `apps/api/prisma/migrations/` |

> Nota: `README.md` dice «16 tablas + 4 vistas»; el esquema real tiene 23 modelos. Actualizar el README.

### 3.2 Autenticación y usuarios 🟢
- `apps/api/src/utils/jwt.ts` — verificación JWT con JWKS remoto de Supabase (la API no emite tokens).
- `apps/api/src/middleware/auth.middleware.ts` — `requireAuth`, `requireRole`.
- `apps/web/src/app/login/login-form.tsx` — `signInWithPassword`.
- `apps/api/src/controllers/registro.controller.ts` — `POST /api/auth/pre-registro`, `/verificar-codigo`.
- `apps/api/src/services/codigo.service.ts` — código hasheado en `cache_registro`, `MAX_INTENTOS_CODIGO = 5`.
- `apps/api/src/services/recuperacion.service.ts` — token SHA-256, TTL 1800 s (30 min), `MAX_POR_CORREO = 3`, `MAX_POR_ORIGEN = 10`. Coincide con el ERS.
- `apps/api/src/services/guardianship.service.ts` — `assertCanActOnPatient`, co-tutela, `finalizarTutelasVencidas`.
- Perfiles con foto y zona horaria: `patient.service.ts`, `psychologist.service.ts`.

### 3.3 Citas y agenda 🟢
- `apps/api/src/routes/appointment.routes.ts` — `GET /api/appointments`, `/occupancy`, `/:id`, `POST /`, `PATCH /:id`, `PATCH /:id/status`, `POST /:id/cancel`, `PATCH /:id/payment`.
- `apps/api/src/routes/appointment-request.routes.ts` — `GET/POST /api/appointment-requests`, `/reschedule`, `/:id/accept`, `/:id/reject`, `/:id/cancel`.
- `apps/api/src/services/appointment.service.ts` — `createAppointment`, `updateAppointment`, `cancelAppointment`, `assertNoOverlap`, `assertNoAgendaBlock`, `toAttendanceStatus`.
- **Anti-empalmes a nivel BD**: `excl_citas_psicologo_sin_empalme`, `excl_citas_paciente_sin_empalme`, `excl_bloqueos_sin_empalme`.
- Bloqueos de agenda (`bloqueo.routes.ts`), horarios (`horarios_psicologo`, `vw_agenda_psicologo`), pagos (`pagos_honorarios`, `vw_honorarios_pendientes`).
- El **flujo BPMN se cumple**: login → programar (manual o solicitud) → verificar disponibilidad → guardar en BD → actualizar agenda → recordatorios → verificar asistencia → consulta + seguimiento clínico.

### 3.4 Historial clínico / bitácora 🟢
- Modelos: `expedientes_clinicos`, `entradas_bitacora`, `consentimientos_informados`, `contactos_emergencia`, `revisiones_bitacora`, `tareas_sesion`.
- `apps/api/src/services/clinical-record.service.ts` — `registrarConsentimiento`, `retirarConsentimiento`, `updateClinicalRecord`; tutor obligatorio para menores (RD-10, RD-11 ✔).
- `apps/api/src/services/log-entry.service.ts` — crear, listar, editar (`version++` → trazabilidad ✔).

### 3.5 Reportes 🟡
- `apps/web/src/app/(app)/reportes/page.tsx` — filtros, presets (Este mes / Mes pasado / Últimos 30 días / Este año), `handleExportCSV` con BOM para Excel, «Imprimir o guardar PDF».

### 3.6 Notificaciones y WhatsApp 🟢/🟡
- `apps/api/src/services/notification.service.ts` — `REGLAS`, `canalesDelEvento`, `redactar`, `notificar`, `programarRecordatorios`, `despacharPendientes`, `enviarWhatsapp`.
- Recordatorios: `RECORDATORIO_24H` (SISTEMA/CORREO/WHATSAPP) y `RECORDATORIO_2H` (WHATSAPP), `REMINDER_HOURS_BEFORE = 24`.
- WhatsApp Cloud API (`graph.facebook.com/.../messages`), plantillas por evento, `normalizarTelefonoWhatsapp`, webhook `POST/GET /api/webhooks/whatsapp`.
- Correo: `apps/api/src/services/mailer.service.ts` (SMTP Gmail).
- Cron interno: `/despachar`, `/finalizar-tutelas`, `/mantenimiento`, `/resumen-bitacora` con `requireCronSecret` (timingSafeEqual).
- Workflow `.github/workflows/despachar-notificaciones.yml` **sí está commiteado** (verificado con `git ls-files`; el doc de pendientes está desactualizado al respecto).

### 3.7 Respaldo y mantenimiento 🟡
- `scripts/backup-db.sh` — `pg_dump -Fc` + datos `auth.users`/`auth.identities`, validación `pg_restore --list`, cifrado `age`, subida S3 opcional.
- `scripts/mantenimiento-bd.mjs` — `VACUUM (ANALYZE)`.
- `apps/api/src/services/mantenimiento.service.ts` — purga por lotes `FOR UPDATE SKIP LOCKED`, **no toca datos clínicos** (RD-09 parcial ✔).
- `scripts/preparar-proyecto-aislado.mjs`, `scripts/verificar-aislamiento.mjs`, fail-closed en preview (`apps/api/src/config/index.ts`).

### 3.8 Multiplataforma 🟡
- PWA web: `apps/web/src/app/manifest.ts` (`display: standalone`), `sw.ts` (Serwist), `offline/page.tsx`.
- No hay React Native/Expo ni app nativa.

### 3.9 Pruebas
- `apps/api/tests`: 33 archivos, 261 `it`.
- `apps/web/tests`: 19 archivos, 130 `it`.

---

## 4. LO QUE FALTA (brechas, priorizado)

### 🔴 Prioridad 1 — Bloquea despliegue
1. **Regenerar cliente Prisma** (`npm run prisma:generate`) → resuelve los 32 errores de TypeScript.
2. **Corregir plantilla de WhatsApp** para que envíe `"Tu cita fue confirmada"` en lugar de `"Mensaje"` (test fallido).

### 🔴 Prioridad 2 — Notificaciones no salen sin esto
3. Configurar en GitHub *Settings → Secrets and variables → Actions*: secret `CRON_SECRET` y variable `API_URL`.
4. Dar de alta en cron-job.org la tarea de **mantenimiento** (diario 03:30). Sin estos pasos, los avisos quedan encolados y **nunca se envían** (`docs/tareas-programadas.md`).
5. Actualizar `docs/tareas-programadas.md`: ya dice que el workflow "falta commitear", pero está en HEAD. Queda registrada la incidencia del borrado del 10 de noviembre.

### 🔴 Prioridad 3 — Seguridad / confidencialidad
6. **RLS inexistente**: no hay `ENABLE ROW LEVEL SECURITY` ni `CREATE POLICY` en el repo; el rol `prisma` usa `BYPASSRLS`. Declarar policies o documentar la decisión.
7. TLS con `rejectUnauthorized: false` en `apps/api/src/lib/prisma.ts` → usar `root.crt` y `rejectUnauthorized: true`.
8. **Auditoría ausente**: `registros_auditoria` solo se escribe en `finalizarTutelasVencidas`. Falta registrar confirmar/cancelar cita (RF_US_005, RF_US_019 del ERS).
9. Política de **retención mínima de expedientes** (RD-09) y **portabilidad PDF del paciente** (RD-13).

### 🟡 Prioridad 4 — Funcionalidades visibles
10. **Exportación real a PDF/XLSX** y persistencia en el modelo `reportes`. Hoy solo CSV + `window.print()` (RF_US_015, RD-13).
11. **Confirmación de asistencia en 1 clic desde WhatsApp** (ERS 2.2.3.2): hoy el mensaje dice «Confírmala desde tu agenda». No hay botón/link.
12. **Recordatorios configurables 12/24/48 h** (ERS 2.2.3.4): hoy son fijos 24 h y 2 h; la UI solo activa/desactiva canales.
13. **Búsqueda de pacientes en la API** (hoy solo filtro client-side en `pacientes/page.tsx`) y alta de pacientes por psicóloga (RF_US_006).
14. Escritura de `revisiones_bitacora` (modelo y migración existen, pero nada escribe).
15. Estado literal **"Solicitud de Reagendar"** del ERS: hoy se cancela y se crea una solicitud pendiente con prefijo `"Cambio de fecha: "`.
16. **Contacto de emergencia** obligatorio también en perfil (hoy solo en registro) — RD-12.
17. **Duración de citas 45–60 min** (RD-06): la validación real es 30–60 (30 para menores).
18. **Tiempo real**: hoy es polling de 2 min (`use-pending-responses.ts`), no Realtime/WebSockets.

### ⚪ No verificable sin más información
19. RNF_US_001 (< 3 s) y RNF_US_002 (500 pacientes / 1000 citas): sin benchmarks ni prueba de carga. La change `2026-10-28-monitorizacion-y-alertas` está 3/7.
20. RNF_US_005 (interfaz intuitiva): sin pruebas de usabilidad.
21. RD-05 (cumplimiento institucional): no hay políticas de la organización en el repo.
22. RNF_US_006 (navegadores): sin matriz de compatibilidad.

### OpenSpec — cambios activos sin cerrar (9)

| Cambio | Tareas | Hechas |
|---|---|---|
| `2026-10-27-despacho-programado-de-notificaciones` | 10 | 2 |
| `2026-10-28-aislar-previews-de-produccion` | 8 | 1 |
| `2026-10-28-catalogo-de-motivos-de-consulta` | 13 | 10 |
| `2026-10-28-copias-de-seguridad-de-datos-clinicos` | 9 | 3 |
| `2026-10-28-mayoria-de-edad-y-fin-de-tutela` | 12 | 7 |
| `2026-10-28-monitorizacion-y-alertas` | 7 | 3 |
| `2026-10-28-tutoria-con-identidad-y-co-tutela` | 15 | 13 |
| `2026-11-03-purga-automatica-de-datos-operativos` | 21 | 19 |
| `2026-11-08-bloqueo-de-agenda` | 10 | 10 ✔ |

Specs canónicas: 7 (`appointment-management` 7, `user-management` 10, `medical-record` 7, `reporting` 2, `notification-management` 4, `data-protection` 9, `data-hosting` 4) = **43 requisitos**.

---

## 5. Matriz completa de requisitos (ERS/RP33)

Leyenda: 🟢 Implementado · 🟡 Parcial · 🔴 Ausente · ⚪ No verificable

### Requisitos funcionales

| Código | Requisito | Estado | Evidencia / brecha |
|---|---|---|---|
| RF_US_001 | Autenticar | 🟢 | JWT/JWKS + `signInWithPassword` |
| RF_US_002 | Solicitud de cita | 🟢 | `POST /api/appointment-requests` (queda pendiente) |
| RF_US_003 | Visualizar información personal | 🟢 | Perfiles |
| RF_US_004 | Registrar usuarios | 🟢 | Pre-registro + verificación |
| RF_US_005 | Editar bitácora | 🟢 | `updateLogEntry` con `version++` |
| RF_US_006 | Buscar paciente | 🟡 | Solo filtro web, no API |
| RF_US_007 | Gestionar perfil | 🟢 | Foto, zona horaria, temas |
| RF_US_008 | Programar cita | 🟢 | `POST /appointments` |
| RF_US_009 | Modificar cita | 🟢 | `PATCH /:id` |
| RF_US_010 | Confirmar cita | 🟡 | `PATCH /:id/status`, sin auditoría |
| RF_US_011 | Cancelar cita | 🟢 | `POST /:id/cancel` transaccional |
| RF_US_012 | Consultar agenda | 🟢 | `/appointments`, `/occupancy` |
| RF_US_013 | Visualizar próximas citas | 🟢 | `dashboard-view.tsx` |
| RF_US_014 | Solicitar reagendar | 🟡 | No hay estado literal "Solicitud de Reagendar" |
| RF_US_015 | Generar reportes | 🟡 | CSV + impresión; sin servicio/endpoint |
| RF_US_016 | Validación de datos | 🟢 | Zod + CHECK/FK |
| RF_US_017 | Control de roles y permisos | 🟢 | `requireRole`, `assertCanActOnPatient` |
| RF_US_018 | Control de sesiones | 🟡 | Sin inactividad/intentos propios |
| RF_US_019 | Gestión de citas | 🟡 | Polling, no Realtime; sin auditoría |
| RF_US_020 | Gestión de notificaciones | 🟢 | Bandeja `SISTEMA`, `leida_en` |
| RF_US_021 | Gestión de bases de datos | 🟢 | Prisma + migraciones + purga |
| RF_US_022 | Restauración de contraseña | 🟢 | `recuperacion.service.ts` |
| RF_US_023 | Ver historial clínico | 🟢 | `GET /:id/clinical-record` |
| RF_US_024 | Guardar entrada de bitácora | 🟢 | `POST /:id/log-entries` |

> ⚠️ **Inconsistencia documental:** `PsicoAgenda/psicoagenda_openspec.md` usa otra numeración RF_US_001–028 con significados distintos (por ejemplo, allí RF_US_019 = "Generar reportes", mientras que en el RP33 RF_US_019 = "Gestión de Citas"). Conviene unificar la numeración en un solo documento maestro.

### Requisitos no funcionales

| Código | Requisito | Estado | Evidencia / brecha |
|---|---|---|---|
| RNF_US_001 | Operaciones < 3 s | ⚪ | Sin benchmarks |
| RNF_US_002 | 500 pacientes / 1000 citas | ⚪ | Sin prueba de carga |
| RNF_US_003 | Cifrado en tránsito y reposo | 🟡 | SSL sin verificar; backups `age`; reposo Supabase |
| RNF_US_004 | Sesión: tiempo e intentos | 🟡 | Rate limits parciales |
| RNF_US_005 | Interfaz intuitiva | ⚪ | Sin pruebas de usabilidad |
| RNF_US_006 | Navegadores modernos | 🟡 | PWA responsive, sin matriz |
| RNF_US_007 | Ley de Protección de Datos | 🟡 | Sin RLS; auditoría parcial |
| RNF_US_008 | Consumo optimizado | 🟡 | Purga/VACUUM/límites, sin medición |
| RNF_US_009 | Escalabilidad | 🟡 | Vercel + Supabase, sin prueba de carga |

### Requisitos de dominio

| Código | Requisito | Estado | Evidencia / brecha |
|---|---|---|---|
| RD-01 | Terminología psicológica | 🟢 | `motivos_consulta`, `tipo_sesion` |
| RD-02 | Confidencialidad profesional | 🟡 | Sin RLS, TLS sin verificación plena |
| RD-03 | Notas por sesión | 🟢 | `entradas_bitacora.notas_sesion` |
| RD-04 | Tono de mensajes | 🟢 | `redactar` + plantillas |
| RD-05 | Cumplimiento institucional | ⚪ | Sin políticas en el repo |
| RD-06 | Tiempos de atención 45–60 min | 🟡 | Validación real 30–60 (30 para menores) |
| RD-07 | Integración con agenda profesional | 🟢 | `horarios_psicologo`, `assertNoAgendaBlock` |
| RD-08 | Control de seguimiento | 🟢 | `progreso`, `plan_proxima_sesion`, `tareas_sesion` |
| RD-09 | Retención de expedientes | 🟡 | Purga excluye clínicos; sin retención mínima |
| RD-10 | Consentimiento informado | 🟢 | `registrarConsentimiento` / `retirarConsentimiento` |
| RD-11 | Menores y tutores | 🟢 | `pacientes_tutores`, mayoría de edad |
| RD-12 | Contacto de emergencia | 🟡 | Obligatorio en registro, opcional en perfil |
| RD-13 | Portabilidad PDF | 🟡 | CSV + `window.print()`, sin PDF generado |
| RD-14 | Estado de pago de honorarios | 🟢 | `pagos_honorarios`, `/payment`, vista |

---

## 6. Contradicciones entre los documentos (requieren decisión)

1. **App móvil** — RP32 y RP33 exigen interfaz *web y móvil*; pero RP33 la lista como **requisito futuro**. El código implementó PWA. ¿Se acepta PWA como "móvil" o se requiere app nativa?
2. **Honorarios / facturación** — RP32 **excluye** módulos de facturación; RD-14 y RP33 exigen estado de pago. El código implementó pagos. ¿Se respeta la delimitación o el RD-14?
3. **Videollamadas** — RP32 las excluye y RP33 las pone como futuro, pero el esquema guarda `enlace_videollamada` (solo un link, no videollamada integrada). Coherente con "solo link".
4. **Rendimiento / disponibilidad** — < 3 s y 99% están en los documentos, pero no hay sonda de latencia ni prueba de carga; la change de monitorización está 3/7.
5. **Numeración RF** — el ERS (RP33) y `psicoagenda_openspec.md` usan códigos RF_US distintos para requisitos diferentes. Unificar.

---

## 7. Próximos pasos recomendados

1. `npm run prisma:generate` → build en verde.
2. Corregir el test/plantilla de WhatsApp.
3. Configurar secretos `CRON_SECRET` / `API_URL` y cron-job.org → notificaciones funcionando.
4. Endurecer seguridad: RLS/policies, TLS estricto, auditoría en cita.
5. Cerrar brechas visibles: PDF/XLSX real, confirmación en 1 clic, recordatorios configurables.
6. Alinear documentación: README (16 tablas → 23 modelos), `docs/tareas-programadas.md`, numeración RF, y decidir app móvil / honorarios / RD-06.
