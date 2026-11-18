-- El recargo por cita el mismo día puede ser un monto fijo en vez de un porcentaje.
-- NULL = se usa el porcentaje (`recargo_mismo_dia_pct`), que es como estaba.
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS recargo_mismo_dia_monto INTEGER;

ALTER TABLE psicologos DROP CONSTRAINT IF EXISTS ck_psicologos_recargo_monto;
ALTER TABLE psicologos ADD CONSTRAINT ck_psicologos_recargo_monto CHECK (
  recargo_mismo_dia_monto IS NULL OR recargo_mismo_dia_monto BETWEEN 0 AND 100000
);
