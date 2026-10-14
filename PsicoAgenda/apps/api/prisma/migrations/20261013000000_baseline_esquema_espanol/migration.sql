-- =============================================================================
-- BASELINE: esquema en español
-- =============================================================================
-- Este archivo es la única migración del proyecto: aplasta las cuatro migraciones
-- anteriores en inglés (que nunca se aplicaron en este proyecto), porque la base
-- nueva ya nace con el esquema en español.
--
-- Estructura del archivo:
--   1. DDL generado de `prisma/schema.prisma` (`prisma migrate diff --from-empty`).
--   2. Sección escrita a mano: CHECKs, índices parciales, índices GiST, vistas y
--      las cuatro funciones de sincronización con `auth.users`. Prisma 7 no puede
--      expresar ninguno de esos objetos en el schema, así que van en la migración.
--
-- Consecuencia operativa: `migrate dev` (que compara contra una base sombra)
-- reportaría drift por los objetos del punto 2. El flujo del proyecto es
-- `prisma migrate diff` + `prisma migrate deploy`, sin base sombra, como ya
-- documenta el README.
--
-- Otra diferencia consciente con el DDL original: los `@default(...)` del schema
-- añaden cláusulas DEFAULT que el DDL no tenía (p. ej. `usuarios.zona_horaria`).
-- Son intencionales y no cambian el comportamiento de los triggers, que siempre
-- suministran los valores.
--
-- El `CREATE SCHEMA IF NOT EXISTS "public"` que emite Prisma se eliminó: `public`
-- ya existe y el rol `prisma` no tiene permiso CREATE sobre la base de datos.
-- =============================================================================



-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('PSICOLOGO', 'PACIENTE', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "estado_solicitud" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "estado_cita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "modalidad_cita" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "tipo_sesion" AS ENUM ('INDIVIDUAL', 'PAREJA', 'FAMILIAR', 'CONSULTA_INICIAL');

-- CreateEnum
CREATE TYPE "estado_expediente" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "estado_consentimiento" AS ENUM ('FIRMADO', 'RETIRADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "tipo_notificacion" AS ENUM ('RECORDATORIO', 'CONFIRMACION', 'CAMBIO', 'CANCELACION');

-- CreateEnum
CREATE TYPE "canal_notificacion" AS ENUM ('WHATSAPP', 'CORREO');

-- CreateEnum
CREATE TYPE "estado_envio" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_reporte" AS ENUM ('CITAS_PERIODO', 'ASISTENCIA_CANCELACIONES', 'PACIENTES_ATENDIDOS', 'HONORARIOS');

-- CreateEnum
CREATE TYPE "formato_reporte" AS ENUM ('PDF', 'XLSX');

-- CreateEnum
CREATE TYPE "estado_pago" AS ENUM ('PENDIENTE', 'PAGADO', 'CONDONADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "correo" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "rol_usuario" NOT NULL DEFAULT 'PACIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "zona_horaria" TEXT NOT NULL DEFAULT 'UTC',
    "foto_perfil_url" TEXT,
    "notificar_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notificar_correo" BOOLEAN NOT NULL DEFAULT true,
    "preferencias_interfaz" JSONB,
    "ultimo_acceso" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psicologos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cedula_profesional" TEXT NOT NULL,
    "especialidad" TEXT,
    "anios_experiencia" INTEGER,
    "biografia" TEXT,

    CONSTRAINT "psicologos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_nacimiento" DATE,
    "sexo" TEXT,
    "direccion" TEXT,
    "tutor_legal_id" UUID,
    "psicologo_id" UUID,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutores_legales" (
    "id" UUID NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "correo" TEXT,
    "telefono" TEXT,
    "parentesco" TEXT,
    "documento_identidad" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutores_legales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_emergencia" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "parentesco" TEXT,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_cita" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "psicologo_id" UUID NOT NULL,
    "inicio_solicitado" TIMESTAMPTZ(3) NOT NULL,
    "tipo_sesion" "tipo_sesion" NOT NULL,
    "motivo" TEXT,
    "estado" "estado_solicitud" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendida_en" TIMESTAMPTZ(3),

    CONSTRAINT "solicitudes_cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas" (
    "id" UUID NOT NULL,
    "psicologo_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "solicitud_id" UUID,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "estado" "estado_cita" NOT NULL DEFAULT 'PENDIENTE',
    "modalidad" "modalidad_cita" NOT NULL DEFAULT 'PRESENCIAL',
    "tipo_sesion" "tipo_sesion" NOT NULL,
    "motivo" TEXT,
    "notas_internas" TEXT,
    "motivo_cancelacion" TEXT,
    "cancelada_por_id" UUID,
    "cancelada_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_psicologo" (
    "id" UUID NOT NULL,
    "psicologo_id" UUID NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "horarios_psicologo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes_clinicos" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "abierto_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo_consulta" TEXT,
    "antecedentes" TEXT,
    "diagnostico" TEXT,
    "observaciones_generales" TEXT,
    "estado" "estado_expediente" NOT NULL DEFAULT 'ACTIVO',
    "conservar_hasta" DATE,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expedientes_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas_bitacora" (
    "id" UUID NOT NULL,
    "expediente_id" UUID NOT NULL,
    "cita_id" UUID,
    "psicologo_id" UUID NOT NULL,
    "fecha_sesion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas_sesion" TEXT NOT NULL,
    "objetivos_trabajados" TEXT,
    "plan_proxima_sesion" TEXT,
    "estado_general" TEXT,
    "progreso" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "entradas_bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisiones_bitacora" (
    "id" UUID NOT NULL,
    "entrada_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "notas_sesion" TEXT NOT NULL,
    "objetivos_trabajados" TEXT,
    "plan_proxima_sesion" TEXT,
    "modificado_por_id" UUID,
    "modificado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisiones_bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimientos_informados" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "firmado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documento" TEXT NOT NULL,
    "documento_url" TEXT,
    "tutor_legal_id" UUID,
    "estado" "estado_consentimiento" NOT NULL DEFAULT 'FIRMADO',
    "retirado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimientos_informados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cita_id" UUID,
    "tipo" "tipo_notificacion" NOT NULL,
    "canal" "canal_notificacion" NOT NULL,
    "asunto" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "estado_envio" NOT NULL DEFAULT 'PENDIENTE',
    "programada_para" TIMESTAMPTZ(3),
    "enviada_en" TIMESTAMPTZ(3),
    "error" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes" (
    "id" UUID NOT NULL,
    "tipo" "tipo_reporte" NOT NULL,
    "psicologo_id" UUID,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fin" DATE NOT NULL,
    "formato" "formato_reporte" NOT NULL,
    "url_archivo" TEXT,
    "generado_por_id" UUID,
    "generado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_honorarios" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" "estado_pago" NOT NULL DEFAULT 'PENDIENTE',
    "pagado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagos_honorarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "psicologos_usuario_id_key" ON "psicologos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "psicologos_cedula_profesional_key" ON "psicologos"("cedula_profesional");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_usuario_id_key" ON "pacientes"("usuario_id");

-- CreateIndex
CREATE INDEX "pacientes_psicologo_id_idx" ON "pacientes"("psicologo_id");

-- CreateIndex
CREATE INDEX "pacientes_tutor_legal_id_idx" ON "pacientes"("tutor_legal_id");

-- CreateIndex
CREATE INDEX "contactos_emergencia_paciente_id_idx" ON "contactos_emergencia"("paciente_id");

-- CreateIndex
CREATE INDEX "solicitudes_cita_paciente_id_idx" ON "solicitudes_cita"("paciente_id");

-- CreateIndex
CREATE INDEX "solicitudes_cita_psicologo_id_estado_idx" ON "solicitudes_cita"("psicologo_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "citas_solicitud_id_key" ON "citas"("solicitud_id");

-- CreateIndex
CREATE INDEX "citas_paciente_id_inicio_idx" ON "citas"("paciente_id", "inicio");

-- CreateIndex
CREATE INDEX "citas_psicologo_id_inicio_idx" ON "citas"("psicologo_id", "inicio");

-- CreateIndex
CREATE INDEX "idx_citas_estado_inicio" ON "citas"("estado", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_psicologo_psicologo_id_dia_semana_hora_inicio_key" ON "horarios_psicologo"("psicologo_id", "dia_semana", "hora_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_clinicos_paciente_id_key" ON "expedientes_clinicos"("paciente_id");

-- CreateIndex
CREATE INDEX "entradas_bitacora_expediente_id_fecha_sesion_idx" ON "entradas_bitacora"("expediente_id", "fecha_sesion");

-- CreateIndex
CREATE INDEX "entradas_bitacora_cita_id_idx" ON "entradas_bitacora"("cita_id");

-- CreateIndex
CREATE INDEX "entradas_bitacora_psicologo_id_idx" ON "entradas_bitacora"("psicologo_id");

-- CreateIndex
CREATE INDEX "revisiones_bitacora_modificado_por_id_idx" ON "revisiones_bitacora"("modificado_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "revisiones_bitacora_entrada_id_version_key" ON "revisiones_bitacora"("entrada_id", "version");

-- CreateIndex
CREATE INDEX "consentimientos_informados_paciente_id_firmado_en_idx" ON "consentimientos_informados"("paciente_id", "firmado_en");

-- CreateIndex
CREATE INDEX "consentimientos_informados_tutor_legal_id_idx" ON "consentimientos_informados"("tutor_legal_id");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_idx" ON "notificaciones"("usuario_id");

-- CreateIndex
CREATE INDEX "notificaciones_cita_id_idx" ON "notificaciones"("cita_id");

-- CreateIndex
CREATE INDEX "notificaciones_estado_programada_para_idx" ON "notificaciones"("estado", "programada_para");

-- CreateIndex
CREATE INDEX "reportes_generado_en_idx" ON "reportes"("generado_en");

-- CreateIndex
CREATE INDEX "reportes_psicologo_id_idx" ON "reportes"("psicologo_id");

-- CreateIndex
CREATE INDEX "reportes_generado_por_id_idx" ON "reportes"("generado_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_honorarios_cita_id_key" ON "pagos_honorarios"("cita_id");

-- CreateIndex
CREATE INDEX "pagos_honorarios_estado_pagado_en_idx" ON "pagos_honorarios"("estado", "pagado_en");

-- CreateIndex
CREATE INDEX "registros_auditoria_usuario_id_idx" ON "registros_auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "registros_auditoria_creado_en_idx" ON "registros_auditoria"("creado_en");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidad_entidad_id_idx" ON "registros_auditoria"("entidad", "entidad_id");

-- AddForeignKey
ALTER TABLE "psicologos" ADD CONSTRAINT "psicologos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_tutor_legal_id_fkey" FOREIGN KEY ("tutor_legal_id") REFERENCES "tutores_legales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_psicologo_id_fkey" FOREIGN KEY ("psicologo_id") REFERENCES "psicologos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_emergencia" ADD CONSTRAINT "contactos_emergencia_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_cita" ADD CONSTRAINT "solicitudes_cita_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_cita" ADD CONSTRAINT "solicitudes_cita_psicologo_id_fkey" FOREIGN KEY ("psicologo_id") REFERENCES "psicologos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_psicologo_id_fkey" FOREIGN KEY ("psicologo_id") REFERENCES "psicologos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_cancelada_por_id_fkey" FOREIGN KEY ("cancelada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_psicologo" ADD CONSTRAINT "horarios_psicologo_psicologo_id_fkey" FOREIGN KEY ("psicologo_id") REFERENCES "psicologos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes_clinicos" ADD CONSTRAINT "expedientes_clinicos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_bitacora" ADD CONSTRAINT "entradas_bitacora_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes_clinicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_bitacora" ADD CONSTRAINT "entradas_bitacora_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_bitacora" ADD CONSTRAINT "entradas_bitacora_psicologo_id_fkey" FOREIGN KEY ("psicologo_id") REFERENCES "psicologos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones_bitacora" ADD CONSTRAINT "revisiones_bitacora_entrada_id_fkey" FOREIGN KEY ("entrada_id") REFERENCES "entradas_bitacora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones_bitacora" ADD CONSTRAINT "revisiones_bitacora_modificado_por_id_fkey" FOREIGN KEY ("modificado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos_informados" ADD CONSTRAINT "consentimientos_informados_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos_informados" ADD CONSTRAINT "consentimientos_informados_tutor_legal_id_fkey" FOREIGN KEY ("tutor_legal_id") REFERENCES "tutores_legales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_psicologo_id_fkey" FOREIGN KEY ("psicologo_id") REFERENCES "psicologos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_generado_por_id_fkey" FOREIGN KEY ("generado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_honorarios" ADD CONSTRAINT "pagos_honorarios_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- 2. Objetos que Prisma no modela (escritos a mano)
-- =============================================================================

-- --- CHECK constraints -------------------------------------------------------
-- 17 reglas de negocio que el DDL existente ya imponía. Prisma 7 no modela CHECK
-- (`@@check` es una feature de Prisma 8), así que van aquí: si alguna vez se
-- necesitan cambiar, se cambia en la base y en este bloque.
ALTER TABLE "usuarios" ADD CONSTRAINT "ck_usuarios_correo"
  CHECK ((correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text));
ALTER TABLE "psicologos" ADD CONSTRAINT "ck_psicologos_anios"
  CHECK (((anios_experiencia IS NULL) OR (anios_experiencia >= 0)));
ALTER TABLE "pacientes" ADD CONSTRAINT "ck_pacientes_menor_con_tutor"
  CHECK (((fecha_nacimiento IS NULL)
       OR (fecha_nacimiento <= (CURRENT_DATE - '18 years'::interval))
       OR (tutor_legal_id IS NOT NULL)));
ALTER TABLE "horarios_psicologo" ADD CONSTRAINT "ck_horarios_dia"
  CHECK (((dia_semana >= 1) AND (dia_semana <= 7)));
ALTER TABLE "horarios_psicologo" ADD CONSTRAINT "ck_horarios_rango"
  CHECK ((hora_fin > hora_inicio));
ALTER TABLE "solicitudes_cita" ADD CONSTRAINT "ck_solicitudes_atendida"
  CHECK (((estado = 'PENDIENTE'::estado_solicitud) OR (atendida_en IS NOT NULL)));
ALTER TABLE "citas" ADD CONSTRAINT "ck_citas_fin"
  CHECK ((fin > inicio));
ALTER TABLE "citas" ADD CONSTRAINT "ck_citas_duracion"
  CHECK ((((fin - inicio) >= '00:45:00'::interval)
      AND ((fin - inicio) <= '01:00:00'::interval)));
ALTER TABLE "citas" ADD CONSTRAINT "ck_citas_cancelacion"
  CHECK (((estado <> 'CANCELADA'::estado_cita)
       OR ((motivo_cancelacion IS NOT NULL) AND (cancelada_en IS NOT NULL))));
ALTER TABLE "expedientes_clinicos" ADD CONSTRAINT "ck_expedientes_conservacion"
  CHECK (((conservar_hasta IS NULL) OR (conservar_hasta >= (abierto_en)::date)));
ALTER TABLE "entradas_bitacora" ADD CONSTRAINT "ck_bitacora_version"
  CHECK ((version >= 1));
ALTER TABLE "consentimientos_informados" ADD CONSTRAINT "ck_consentimiento_retiro"
  CHECK (((estado <> 'RETIRADO'::estado_consentimiento) OR (retirado_en IS NOT NULL)));
ALTER TABLE "notificaciones" ADD CONSTRAINT "ck_notificaciones_intentos"
  CHECK ((intentos >= 0));
ALTER TABLE "notificaciones" ADD CONSTRAINT "ck_notificaciones_envio"
  CHECK (((estado <> 'ENVIADA'::estado_envio) OR (enviada_en IS NOT NULL)));
ALTER TABLE "reportes" ADD CONSTRAINT "ck_reportes_periodo"
  CHECK ((periodo_fin >= periodo_inicio));
ALTER TABLE "pagos_honorarios" ADD CONSTRAINT "ck_pagos_monto"
  CHECK ((monto >= (0)::numeric));
ALTER TABLE "pagos_honorarios" ADD CONSTRAINT "ck_pagos_fecha"
  CHECK (((estado <> 'PAGADO'::estado_pago) OR (pagado_en IS NOT NULL)));

-- --- Índices parciales -------------------------------------------------------
-- Dos de ellos son la garantía de que ningún psicólogo (ni paciente) tenga dos
-- citas activas solapadas: se apoyan en los índices GiST de abajo.
CREATE UNIQUE INDEX "ux_contacto_principal"
  ON "contactos_emergencia" USING btree (paciente_id) WHERE es_principal;
CREATE INDEX "idx_notificaciones_pendientes"
  ON "notificaciones" USING btree (programada_para)
  WHERE (estado = 'PENDIENTE'::estado_envio);

-- --- Índices GiST anti-solape ------------------------------------------------
-- tstzrange(inicio, fin) + GiST: son los que permiten buscar solapes sin una
-- comparación O(n²) y son la mitad de la garantía anterior.
CREATE INDEX "ex_citas_paciente_sin_empalme"
  ON "citas" USING gist (paciente_id, tstzrange(inicio, fin))
  WHERE (estado = ANY (ARRAY['PENDIENTE'::estado_cita, 'CONFIRMADA'::estado_cita]));
CREATE INDEX "ex_citas_psicologo_sin_empalme"
  ON "citas" USING gist (psicologo_id, tstzrange(inicio, fin))
  WHERE (estado = ANY (ARRAY['PENDIENTE'::estado_cita, 'CONFIRMADA'::estado_cita]));

-- --- Vistas ------------------------------------------------------------------
-- Prisma no modela vistas: se recrean aquí y quedan fuera de la comparación de
-- drift. Al estar en la misma migración, `migrate deploy` las restablece.
CREATE VIEW "vw_agenda_psicologo" AS
 SELECT c.psicologo_id,
    c.id AS cita_id,
    c.inicio,
    c.fin,
    c.estado,
    c.modalidad,
    c.tipo_sesion,
    u.nombre_completo AS paciente
   FROM ((citas c
     JOIN pacientes p ON ((p.id = c.paciente_id)))
     JOIN usuarios u ON ((u.id = p.usuario_id)));

CREATE VIEW "vw_asistencia_mensual" AS
 SELECT psicologo_id,
    (date_trunc('month'::text, inicio))::date AS mes,
    count(*) AS total_citas,
    count(*) FILTER (WHERE (estado = 'COMPLETADA'::estado_cita)) AS atendidas,
    count(*) FILTER (WHERE (estado = 'CANCELADA'::estado_cita)) AS canceladas,
    count(*) FILTER (WHERE (estado = 'NO_ASISTIO'::estado_cita)) AS inasistencias,
    round(((100.0 * (count(*) FILTER (WHERE (estado = 'COMPLETADA'::estado_cita)))::numeric)
      / (NULLIF(count(*) FILTER (WHERE (estado = ANY (ARRAY['COMPLETADA'::estado_cita, 'NO_ASISTIO'::estado_cita]))), 0))::numeric), 1) AS tasa_asistencia
   FROM citas
  GROUP BY psicologo_id, (date_trunc('month'::text, inicio));

CREATE VIEW "vw_honorarios_pendientes" AS
 SELECT c.psicologo_id,
    c.id AS cita_id,
    c.inicio,
    pg.monto,
    pg.estado
   FROM (pagos_honorarios pg
     JOIN citas c ON ((c.id = pg.cita_id)))
  WHERE (pg.estado = 'PENDIENTE'::estado_pago);

CREATE VIEW "vw_pacientes" AS
 SELECT p.id AS paciente_id,
    u.nombre_completo,
    u.correo,
    u.telefono,
    p.psicologo_id,
    p.fecha_nacimiento,
    (date_part('year'::text, age((CURRENT_DATE)::timestamp with time zone, (p.fecha_nacimiento)::timestamp with time zone)))::integer AS edad,
    COALESCE((p.fecha_nacimiento > (CURRENT_DATE - '18 years'::interval)), false) AS es_menor,
    p.tutor_legal_id
   FROM (pacientes p
     JOIN usuarios u ON ((u.id = p.usuario_id)));

-- =============================================================================
-- Funciones de sincronización con `auth.users`
-- =============================================================================
-- Son SECURITY DEFINER porque se disparan dentro de GoTrue (rol
-- `supabase_auth_admin`), que no tiene privilegios de escritura sobre las tablas
-- de `public`. El dueño es el rol `prisma` (quien aplica la migración), así que
-- corren con el menor privilegio posible.
--
-- IDIOMA DE LOS ROLES: el claim en `app_metadata.role` sigue viajando en inglés
-- (`PATIENT`/`PSYCHOLOGIST`/`ADMIN`), que es lo que leen `toBusinessRole`
-- (apps/api/src/utils/jwt.ts) y la web. La traducción al enum español
-- (`rol_usuario`) ocurre SOLO al escribir en la base.
--
-- ADVERTENCIA OPERATIVA: los cuerpos `$$` son seguros porque los aplica el motor
-- de migraciones. `@prisma/adapter-pg` parte los scripts por `;`, así que
-- `prisma db execute` y el seed no deben contener funciones PL/pgSQL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  declared_role text;
BEGIN
  -- El rol de negocio viaja en app_metadata, que el cliente no puede modificar.
  declared_role := upper(coalesce(new.raw_app_meta_data ->> 'role', ''));

  INSERT INTO public.usuarios (
    id, correo, nombre_completo, telefono, rol, activo, zona_horaria,
    notificar_whatsapp, notificar_correo, ultimo_acceso, creado_en, actualizado_en
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    CASE
      WHEN declared_role = 'PSYCHOLOGIST' THEN 'PSICOLOGO'::rol_usuario
      WHEN declared_role = 'ADMIN'        THEN 'ADMINISTRADOR'::rol_usuario
      ELSE 'PACIENTE'::rol_usuario
    END,
    (new.banned_until IS NULL OR new.banned_until < now()),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    false,
    true,
    new.last_sign_in_at,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END
$$;

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  declared_role text;
BEGIN
  declared_role := upper(coalesce(new.raw_app_meta_data ->> 'role', ''));

  INSERT INTO public.usuarios (
    id, correo, nombre_completo, telefono, rol, activo, zona_horaria,
    notificar_whatsapp, notificar_correo, ultimo_acceso, creado_en, actualizado_en
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    CASE
      WHEN declared_role = 'PSYCHOLOGIST' THEN 'PSICOLOGO'::rol_usuario
      WHEN declared_role = 'ADMIN'        THEN 'ADMINISTRADOR'::rol_usuario
      ELSE 'PACIENTE'::rol_usuario
    END,
    (new.banned_until IS NULL OR new.banned_until < now()),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    false,
    true,
    new.last_sign_in_at,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET correo           = EXCLUDED.correo,
        nombre_completo  = EXCLUDED.nombre_completo,
        telefono         = EXCLUDED.telefono,
        -- Si el claim no declara rol se conserva el ya establecido: la
        -- verificación de tokens falla cerrada ante un claim sin rol.
        rol              = CASE
                             WHEN declared_role IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN')
                               THEN EXCLUDED.rol
                             ELSE public.usuarios.rol
                           END,
        activo           = EXCLUDED.activo,
        ultimo_acceso    = EXCLUDED.ultimo_acceso,
        actualizado_en   = EXCLUDED.actualizado_en;

  RETURN new;
END
$$;

-- Baja: la identidad desaparece del proveedor. El perfil NO se borra (retención
-- de expedientes), se anonimiza y se marca inactivo. Sin el cast: `usuarios.id`
-- y `auth.users.id` son los dos `uuid`, no hace falta convertir.
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios
     SET correo          = 'eliminado+' || replace(old.id::text, '-', '') || '@psicoagenda.invalid',
         telefono        = NULL,
         activo          = false,
         actualizado_en  = now()
   WHERE id = old.id;

  RETURN old;
END
$$;

-- Siembra del rol de negocio por defecto en `app_metadata`. Va ANTES del
-- AFTER INSERT que crea el perfil, y sin SECURITY DEFINER a propósito: corre
-- como el rol que inserta (GoTrue) y por eso puede reescribir NEW.
CREATE OR REPLACE FUNCTION public.seed_business_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  declared text;
BEGIN
  declared := upper(coalesce(NEW.raw_app_meta_data ->> 'role', ''));

  -- Solo se interviene el hueco: un rol ya declarado (promoción, alta
  -- administrativa) se respeta tal cual.
  IF declared NOT IN ('PSYCHOLOGIST', 'PATIENT', 'ADMIN') THEN
    NEW.raw_app_meta_data := jsonb_set(
      coalesce(NEW.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"PATIENT"'::jsonb,
      true
    );
  END IF;

  RETURN NEW;
END
$$;

-- Los DISPARADORES no van en la migración: crearlos exige privilegio TRIGGER
-- sobre `auth.users`, que es de `supabase_auth_admin` y `prisma` no lo tiene
-- (ni puede recibirlo). Se aplican aparte con `postgres`
-- (prisma/supabase/auth_user_triggers.sql), y por eso `migrate status` no los
-- cubre.
