import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { config } from "@/config";

/**
 * Puerta de las tareas internas que se disparan desde fuera (`/api/internal/*`).
 *
 * POR QUÉ EXISTE
 * --------------
 * El despacho de notificaciones es una URL pública con efectos reales: envía
 * correos por Gmail y mensajes de WhatsApp por n8n a pacientes. Sin secreto,
 * cualquiera que descubra la URL puede agotar la cuota de correo, mandar
 * mensajes desde el número del consultorio o saturar el pool de conexiones.
 *
 * Es el mismo criterio que el resto de la API: `/health` es público porque no
 * tiene efectos; todo lo que escribe o dispara algo exige credencial.
 *
 * TRES DETALLES
 * -------------
 *  1. Comparación con `timingSafeEqual` y longitudes primero, para no filtrar
 *     por tiempo cuántos caracteres acertó quien prueba.
 *  2. El secreto viaja en la cabecera `Authorization: Bearer`, no en la ruta:
 *     las rutas quedan en logs, en `Referer` y en proxies intermedios.
 *  3. Falla cerrado: sin `CRON_SECRET` configurado responde 503, nunca 200.
 *     Un despliegue al que se le olvidó la variable no queda abierto al mundo.
 */

const iguales = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

const tokenDelEncabezado = (encabezado: string | undefined): string | null => {
  if (!encabezado) return null;
  const coincidencia = /^Bearer\s+(.+)$/i.exec(encabezado.trim());
  return coincidencia?.[1] ?? null;
};

export const requireCronSecret: RequestHandler = (req, res, next) => {
  const esperado = config.cronSecret;

  if (!esperado) {
    res.status(503).json({
      error: {
        code: "CRON_NO_CONFIGURADO",
        message: "El despacho interno no está configurado en este entorno.",
      },
    });
    return;
  }

  const recibido = tokenDelEncabezado(req.headers.authorization);

  if (!recibido || !iguales(recibido, esperado)) {
    res.status(401).json({
      error: {
        code: "NO_AUTORIZADO",
        message: "Credencial de cron inválida.",
      },
    });
    return;
  }

  next();
};
