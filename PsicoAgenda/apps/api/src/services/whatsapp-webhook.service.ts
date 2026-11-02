import { prisma } from "@/lib/prisma";
import { estado_envio } from "@/generated/prisma/enums";

interface WhatsAppStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id?: string;
  errors?: unknown[];
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        statuses?: WhatsAppStatus[];
      };
    }>;
  }>;
}

/**
 * Procesa los estados de entrega que envía WhatsApp Cloud API vía webhook.
 * Meta puede agrupar varios estados en un mismo POST; se actualizan todos los
 * mensajes cuyo `mensaje_externo_id` coincida con `status.id`.
 */
export async function procesarEstadoWhatsapp(payload: unknown): Promise<{ actualizadas: number }> {
  const body = payload as WebhookPayload;
  if (!body.entry || !Array.isArray(body.entry)) {
    return { actualizadas: 0 };
  }

  let actualizadas = 0;

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      const statuses = change.value?.statuses ?? [];
      for (const status of statuses) {
        if (!status.id || !status.status) continue;

        const timestamp = Number.parseInt(status.timestamp, 10);
        const data: {
          estado_entrega: string;
          entregada_en: Date;
          estado?: estado_envio;
          error?: string;
        } = {
          estado_entrega: status.status,
          entregada_en: new Date(timestamp * 1000),
        };

        if (status.status === "failed") {
          data.estado = estado_envio.FALLIDA;
          data.error = status.errors
            ? JSON.stringify(status.errors).slice(0, 500)
            : "WhatsApp reportó fallo de entrega";
        }

        const { count } = await prisma.notificaciones.updateMany({
          where: { mensaje_externo_id: status.id },
          data,
        });
        actualizadas += count;
      }
    }
  }

  return { actualizadas };
}
