import { Router } from "express";
import { requireCronSecret } from "@/middleware/cron.middleware";
import { despacharPendientes } from "@/services/notification.service";
import { limpiarCacheRegistroVencida } from "@/services/codigo-cache.repo";
import { finalizarTutelasVencidas } from "@/services/guardianship.service";

const router = Router();

/**
 * Barrido de la cola de notificaciones.
 *
 * Sustituye al `setInterval` que solo puede existir en un proceso de larga vida.
 * En Vercel lo llama `.github/workflows/despachar-notificaciones.yml` cada 5 minutos;
 * ver la sección "Despliegue" del README.
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

/**
 * Fin de tutela al cumplir 18 (una vez al día). Los permisos ya se cortan al
 * autorizar; este barrido solo borra los vínculos, audita y avisa.
 */
router.post("/finalizar-tutelas", requireCronSecret, async (_req, res) => {
  res.json({ ok: true, finalizadas: await finalizarTutelasVencidas() });
});

export { router as internalRouter };
