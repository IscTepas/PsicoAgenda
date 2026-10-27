import { Router } from "express";
import { requireCronSecret } from "@/middleware/cron.middleware";
import { despacharPendientes } from "@/services/notification.service";
import { limpiarCacheRegistroVencida } from "@/services/codigo-cache.repo";

const router = Router();

/**
 * Barrido de la cola de notificaciones.
 *
 * Sustituye al `setInterval` que solo puede existir en un proceso de larga vida.
 * En Vercel lo llama un cron externo (cron-job.org) cada minuto; ver el ticket
 * `TICKET-2026-10-27-cron-externo.md` y la sección "Despliegue" del README.
 *
 * Es idempotente y seguro con ejecuciones solapadas: `despacharPendientes`
 * reclama cada fila con un `updateMany` condicionado por `intentos`, así que dos
 * disparadores simultáneos no envían lo mismo dos veces.
 */
router.post("/despachar", requireCronSecret, async (_req, res) => {
  const procesadas = await despacharPendientes();

  // El barrido de códigos vencidos es oportunista: si falla, no debe convertir
  // un despacho correcto en un 500 (el cron reintentaría sin motivo).
  const vencidas = await limpiarCacheRegistroVencida().catch((error: unknown) => {
    console.error("[cache] No se pudieron borrar las entradas vencidas:", error);
    return 0;
  });

  res.json({ ok: true, procesadas, vencidas, enviadaEn: new Date().toISOString() });
});

export { router as internalRouter };
