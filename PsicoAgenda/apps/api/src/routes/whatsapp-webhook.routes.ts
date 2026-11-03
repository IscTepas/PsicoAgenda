import { Router } from "express";
import {
  recibirWhatsappWebhookController,
  verificarWhatsappWebhookController,
} from "@/controllers/whatsapp-webhook.controller";

const router = Router();

router.get("/whatsapp", verificarWhatsappWebhookController);
router.post("/whatsapp", recibirWhatsappWebhookController);

export default router;
