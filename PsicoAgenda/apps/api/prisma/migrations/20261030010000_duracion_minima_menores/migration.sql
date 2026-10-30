-- Las sesiones de menores duran 30 minutos (`getEffectiveDurationMinutes` y la tarifa
-- de menor), pero el CHECK de la baseline exigía 45–60: aceptar la solicitud de un menor
-- fallaba con 23514. El rango pasa a 30–60; los adultos siguen acotados a 45–60 por zod.
ALTER TABLE citas DROP CONSTRAINT IF EXISTS ck_citas_duracion;
ALTER TABLE citas ADD CONSTRAINT ck_citas_duracion
  CHECK ((fin - inicio) >= interval '30 minutes' AND (fin - inicio) <= interval '60 minutes');
