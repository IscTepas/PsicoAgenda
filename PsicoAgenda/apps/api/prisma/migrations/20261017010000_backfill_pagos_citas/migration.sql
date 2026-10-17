-- Rellena el honorario pendiente de las citas agendadas antes de que el alta de
-- citas creara su fila en `pagos_honorarios`.
--
-- Solo se tocan citas no canceladas y con precio conocido: una cita cancelada no
-- debe dejar deuda pendiente y una cita sin precio no tiene tarifa que cobrar. Es
-- idempotente (`ON CONFLICT DO NOTHING`), así que repetirla no duplica pagos.
INSERT INTO "pagos_honorarios" ("id", "cita_id", "monto", "estado", "actualizado_en")
SELECT gen_random_uuid(), c."id", c."precio", 'PENDIENTE'::"estado_pago", CURRENT_TIMESTAMP
FROM "citas" c
WHERE c."estado" <> 'CANCELADA'
  AND c."precio" IS NOT NULL
  AND c."precio" > 0
ON CONFLICT ("cita_id") DO NOTHING;
