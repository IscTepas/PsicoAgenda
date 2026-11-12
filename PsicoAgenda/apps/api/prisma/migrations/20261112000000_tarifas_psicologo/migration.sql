-- Tarifas configurables por psicólogo. Los DEFAULT son los valores que antes
-- estaban fijos en el código, así que ningún precio cambia al aplicar esto.
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS tarifa_adulto INTEGER NOT NULL DEFAULT 800;
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS tarifa_menor INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS recargo_mismo_dia_pct INTEGER NOT NULL DEFAULT 30;
ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS descuento_virtual INTEGER NOT NULL DEFAULT 100;

ALTER TABLE psicologos DROP CONSTRAINT IF EXISTS ck_psicologos_tarifas;
ALTER TABLE psicologos ADD CONSTRAINT ck_psicologos_tarifas CHECK (
  tarifa_adulto BETWEEN 0 AND 100000
  AND tarifa_menor BETWEEN 0 AND 100000
  AND recargo_mismo_dia_pct BETWEEN 0 AND 300
  AND descuento_virtual BETWEEN 0 AND 100000
);
