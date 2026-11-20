-- Expediente clínico conforme a la NOM-004-SSA3-2012 y la NOM-024-SSA3-2012:
-- carátula, historia clínica completa, notas que no se alteran una vez cerradas
-- (con sello SHA-256 y notas aclaratorias), baja lógica y auditoría de solo inserción.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE estado_nota AS ENUM ('BORRADOR', 'CERRADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_nota AS ENUM ('EVOLUCION', 'ACLARATORIA', 'INTERCONSULTA', 'EGRESO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Carátula: datos del establecimiento
-- ---------------------------------------------------------------------------
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS nombre_consultorio TEXT;
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS tipo_establecimiento TEXT NOT NULL DEFAULT 'Consultorio de psicología';
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS domicilio_consultorio TEXT;

-- ---------------------------------------------------------------------------
-- Paciente: baja lógica (nunca se borra; el expediente se conserva 5 años)
-- ---------------------------------------------------------------------------
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ(3);

-- Aviso de privacidad aceptado al crear la cuenta.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aviso_privacidad_aceptado_en TIMESTAMPTZ(3);

-- ---------------------------------------------------------------------------
-- Historia clínica psicológica
-- ---------------------------------------------------------------------------
ALTER TABLE expedientes_clinicos ADD COLUMN IF NOT EXISTS folio SERIAL;
DO $$ BEGIN
  ALTER TABLE expedientes_clinicos ADD CONSTRAINT expedientes_clinicos_folio_key UNIQUE (folio);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

ALTER TABLE expedientes_clinicos
  ADD COLUMN IF NOT EXISTS problema_actual TEXT,
  ADD COLUMN IF NOT EXISTS antecedentes_heredofamiliares TEXT,
  ADD COLUMN IF NOT EXISTS antecedentes_no_patologicos TEXT,
  ADD COLUMN IF NOT EXISTS antecedentes_patologicos TEXT,
  ADD COLUMN IF NOT EXISTS examen_mental JSONB,
  ADD COLUMN IF NOT EXISTS pruebas_psicometricas TEXT,
  ADD COLUMN IF NOT EXISTS diagnostico_codigo TEXT,
  ADD COLUMN IF NOT EXISTS diagnostico_sistema TEXT,
  ADD COLUMN IF NOT EXISTS pronostico TEXT,
  ADD COLUMN IF NOT EXISTS plan_terapeutico TEXT,
  ADD COLUMN IF NOT EXISTS historia_estado estado_nota NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN IF NOT EXISTS historia_cerrada_en TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS historia_cerrada_por UUID,
  ADD COLUMN IF NOT EXISTS historia_hash TEXT;

ALTER TABLE expedientes_clinicos DROP CONSTRAINT IF EXISTS ck_expedientes_diagnostico_sistema;
ALTER TABLE expedientes_clinicos ADD CONSTRAINT ck_expedientes_diagnostico_sistema
  CHECK (diagnostico_sistema IS NULL OR diagnostico_sistema IN ('CIE-10', 'CIE-11'));

-- ---------------------------------------------------------------------------
-- Notas: tipo, estado, sello y nota padre (aclaratorias)
-- ---------------------------------------------------------------------------
ALTER TABLE entradas_bitacora
  ADD COLUMN IF NOT EXISTS tipo tipo_nota NOT NULL DEFAULT 'EVOLUCION',
  ADD COLUMN IF NOT EXISTS estado estado_nota NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN IF NOT EXISTS cerrada_en TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS cerrada_por_id UUID,
  ADD COLUMN IF NOT EXISTS hash TEXT,
  ADD COLUMN IF NOT EXISTS nota_padre_id UUID REFERENCES entradas_bitacora(id),
  ADD COLUMN IF NOT EXISTS referido_a TEXT,
  ADD COLUMN IF NOT EXISTS motivo_referencia TEXT,
  ADD COLUMN IF NOT EXISTS motivo_egreso TEXT,
  ADD COLUMN IF NOT EXISTS resumen_egreso TEXT;

CREATE INDEX IF NOT EXISTS entradas_bitacora_nota_padre_id_idx ON entradas_bitacora (nota_padre_id);

-- Una aclaratoria siempre cuelga de otra nota; las demás nunca.
ALTER TABLE entradas_bitacora DROP CONSTRAINT IF EXISTS ck_entradas_aclaratoria_padre;
ALTER TABLE entradas_bitacora ADD CONSTRAINT ck_entradas_aclaratoria_padre
  CHECK ((tipo = 'ACLARATORIA') = (nota_padre_id IS NOT NULL));

-- Una nota cerrada siempre lleva su sello.
ALTER TABLE entradas_bitacora DROP CONSTRAINT IF EXISTS ck_entradas_cerrada_sello;
ALTER TABLE entradas_bitacora ADD CONSTRAINT ck_entradas_cerrada_sello
  CHECK (estado = 'BORRADOR' OR (cerrada_en IS NOT NULL AND hash IS NOT NULL));

-- Consentimiento: firma en pantalla y aviso de privacidad.
ALTER TABLE consentimientos_informados
  ADD COLUMN IF NOT EXISTS firma_imagen TEXT,
  ADD COLUMN IF NOT EXISTS aviso_privacidad_aceptado BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Sello de las notas que ya existían: quedan cerradas tal como están.
-- Misma fórmula que `apps/api/src/lib/sello.ts`:
--   sha256( contenido ␞ cédula ␞ paciente_id ␞ cerrada_en ISO )
--   contenido = campos de la nota unidos con ␟ (chr 31); ␞ = chr 30.
-- ---------------------------------------------------------------------------
UPDATE entradas_bitacora e
SET estado = 'CERRADA',
    cerrada_en = e.actualizado_en,
    cerrada_por_id = p.usuario_id,
    hash = encode(sha256(convert_to(
      concat_ws(chr(30),
        concat_ws(chr(31),
          e.tipo::text,
          to_char(e.fecha_sesion AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          e.notas_sesion,
          coalesce(e.objetivos_trabajados, ''),
          coalesce(e.plan_proxima_sesion, ''),
          coalesce(e.estado_general, ''),
          coalesce(e.referido_a, ''),
          coalesce(e.motivo_referencia, ''),
          coalesce(e.motivo_egreso, ''),
          coalesce(e.resumen_egreso, ''),
          coalesce(e.nota_padre_id::text, '')
        ),
        p.cedula_profesional,
        x.paciente_id::text,
        to_char(e.actualizado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ), 'UTF8')), 'hex')
FROM psicologos p, expedientes_clinicos x
WHERE p.id = e.psicologo_id
  AND x.id = e.expediente_id
  AND e.estado = 'BORRADOR';

-- ---------------------------------------------------------------------------
-- Candados: lo cerrado no se modifica ni se borra (ni siquiera por SQL directo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nota_cerrada_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'CERRADA' THEN
    RAISE EXCEPTION 'La nota % está cerrada: no se puede modificar ni borrar. Agrega una nota aclaratoria.', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nota_cerrada_inmutable ON entradas_bitacora;
CREATE TRIGGER trg_nota_cerrada_inmutable
  BEFORE UPDATE OR DELETE ON entradas_bitacora
  FOR EACH ROW EXECUTE FUNCTION public.nota_cerrada_inmutable();

CREATE OR REPLACE FUNCTION public.historia_cerrada_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.historia_estado <> 'CERRADA' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'El expediente % tiene la historia clínica cerrada: no se puede borrar.', OLD.id USING ERRCODE = 'P0001';
  END IF;
  -- Solo se bloquean los apartados de la historia; el estado del expediente,
  -- las observaciones y la conservación siguen editables.
  IF (NEW.motivo_consulta, NEW.problema_actual, NEW.antecedentes, NEW.antecedentes_heredofamiliares,
      NEW.antecedentes_no_patologicos, NEW.antecedentes_patologicos, NEW.examen_mental,
      NEW.pruebas_psicometricas, NEW.diagnostico, NEW.diagnostico_codigo, NEW.diagnostico_sistema,
      NEW.pronostico, NEW.plan_terapeutico, NEW.historia_estado, NEW.historia_cerrada_en,
      NEW.historia_cerrada_por, NEW.historia_hash)
     IS DISTINCT FROM
     (OLD.motivo_consulta, OLD.problema_actual, OLD.antecedentes, OLD.antecedentes_heredofamiliares,
      OLD.antecedentes_no_patologicos, OLD.antecedentes_patologicos, OLD.examen_mental,
      OLD.pruebas_psicometricas, OLD.diagnostico, OLD.diagnostico_codigo, OLD.diagnostico_sistema,
      OLD.pronostico, OLD.plan_terapeutico, OLD.historia_estado, OLD.historia_cerrada_en,
      OLD.historia_cerrada_por, OLD.historia_hash) THEN
    RAISE EXCEPTION 'La historia clínica del expediente % está cerrada: no se puede modificar. Agrega una nota aclaratoria.', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_historia_cerrada_inmutable ON expedientes_clinicos;
CREATE TRIGGER trg_historia_cerrada_inmutable
  BEFORE UPDATE OR DELETE ON expedientes_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.historia_cerrada_inmutable();

CREATE OR REPLACE FUNCTION public.auditoria_solo_insercion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría es de solo inserción.' USING ERRCODE = 'P0001';
END $$;

DROP TRIGGER IF EXISTS trg_auditoria_solo_insercion ON registros_auditoria;
CREATE TRIGGER trg_auditoria_solo_insercion
  BEFORE UPDATE OR DELETE ON registros_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_solo_insercion();
