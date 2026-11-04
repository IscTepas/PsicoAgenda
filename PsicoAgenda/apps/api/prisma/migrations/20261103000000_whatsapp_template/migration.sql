-- Añade el nombre de la plantilla de WhatsApp a usar en cada notificación.
ALTER TABLE notificaciones
  ADD COLUMN plantilla_whatsapp VARCHAR(255);
