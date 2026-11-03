import type { RequestHandler } from "express";
import { config } from "@/config";
import { procesarEstadoWhatsapp } from "@/services/whatsapp-webhook.service";

/**
 * GET /webhooks/whatsapp
 *
 * Verificación requerida por Meta al suscribir el webhook.
 * Devuelve el `hub.challenge` cuando el `hub.verify_token` coincide.
 */
export const verificarWhatsappWebhookController: RequestHandler = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    typeof token === "string" &&
    token === config.whatsappWebhookVerifyToken &&
    typeof challenge === "string"
  ) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
};

/**
 * POST /webhooks/whatsapp
 *
 * Recibe los eventos de estado de entrega de WhatsApp (accepted, delivered,
 * read, failed, etc.) y actualiza la fila de notificación correspondiente.
 */
export const recibirWhatsappWebhookController: RequestHandler = async (req, res) => {
  const resultado = await procesarEstadoWhatsapp(req.body);
  res.json({ ok: true, ...resultado });
};
