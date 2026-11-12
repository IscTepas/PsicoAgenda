-- Un paciente no puede tener dos solicitudes PENDIENTES para el mismo horario.
-- El servicio ya lo comprobaba, pero con un SELECT previo: dos envíos simultáneos
-- (doble clic, dos pestañas) pasaban ambos. El índice lo vuelve imposible.

-- Si ya existen duplicados, se conserva la solicitud más reciente y las demás se
-- retiran, para que el índice pueda crearse.
UPDATE solicitudes_cita s
   SET estado = 'CANCELADA', atendida_en = now()
 WHERE s.estado = 'PENDIENTE'
   AND EXISTS (
     SELECT 1 FROM solicitudes_cita otra
      WHERE otra.paciente_id = s.paciente_id
        AND otra.inicio_solicitado = s.inicio_solicitado
        AND otra.estado = 'PENDIENTE'
        AND (otra.creado_en, otra.id) > (s.creado_en, s.id)
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_pendiente_por_horario
  ON solicitudes_cita (paciente_id, inicio_solicitado)
  WHERE estado = 'PENDIENTE';
