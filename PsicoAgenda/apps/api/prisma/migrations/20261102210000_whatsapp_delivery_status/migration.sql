-- Añade seguimiento del estado de entrega de mensajes de WhatsApp Business API.
ALTER TABLE notificaciones
  ADD COLUMN mensaje_externo_id VARCHAR(255),
  ADD COLUMN estado_entrega VARCHAR(50),
  ADD COLUMN entregada_en TIMESTAMPTZ(3);
