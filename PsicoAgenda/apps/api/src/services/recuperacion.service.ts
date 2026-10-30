import { createHash, randomBytes } from "node:crypto";
import { config } from "@/config";
import { prisma } from "@/lib/prisma";
import { actualizarContrasena } from "@/lib/supabase-admin";
import { cacheRegistro } from "@/services/codigo-cache.repo";
import { enviarEnlaceRecuperacion } from "@/services/mailer.service";
import { AppError } from "@/utils/app-error";

/**
 * Recuperación de contraseña con el mailer propio (antes: SMTP de Supabase,
 * 2 correos por hora).
 *
 * Mismo almacén que los códigos de registro (`cache_registro`): el token viaja
 * en el enlace y en la base solo queda su SHA-256, así que un volcado no sirve
 * para restablecer nada. Se consume una vez y caduca a los 30 minutos.
 */

export const TOKEN_TTL_SECONDS = 1800;
export const RATE_VENTANA_SECONDS = 900;
/** Correos de recuperación por dirección dentro de la ventana. */
export const MAX_POR_CORREO = 3;
/** Solicitudes por origen (IP) dentro de la ventana. */
export const MAX_POR_ORIGEN = 10;

const sha256 = (valor: string): string => createHash("sha256").update(valor).digest("hex");
const claveToken = (token: string): string => `recuperacion:token:${sha256(token)}`;

const limitar = async (clave: string, maximo: number): Promise<void> => {
  if ((await cacheRegistro.incr(clave, RATE_VENTANA_SECONDS)) > maximo) {
    throw new AppError(
      429,
      `Demasiadas solicitudes. Intenta de nuevo en ${RATE_VENTANA_SECONDS / 60} minutos.`,
      "RATE_LIMIT",
      // shortcut: es la ventana completa, no lo que falta de ella; `incr` no devuelve el TTL.
      { retryAfterSeconds: RATE_VENTANA_SECONDS },
    );
  }
};

/**
 * Responde igual exista o no la cuenta: los límites se cuentan antes de buscarla
 * y un fallo del correo se registra pero no se devuelve, para que el endpoint no
 * sirva para averiguar qué correos están registrados.
 */
export async function solicitarRecuperacion(email: string, origen: string): Promise<void> {
  const correo = email.trim().toLowerCase();
  await limitar(`recuperacion:rate:ip:${origen}`, MAX_POR_ORIGEN);
  await limitar(`recuperacion:rate:correo:${correo}`, MAX_POR_CORREO);

  const usuario = await prisma.usuarios.findUnique({
    where: { correo },
    select: { id: true, activo: true },
  });
  if (!usuario?.activo) return;

  const token = randomBytes(32).toString("base64url");
  await cacheRegistro.set(claveToken(token), usuario.id, TOKEN_TTL_SECONDS);

  const enlace = `${config.webUrl}/recuperar/nueva?token=${token}`;
  try {
    await enviarEnlaceRecuperacion(correo, enlace, TOKEN_TTL_SECONDS / 60);
  } catch (error) {
    await cacheRegistro.del(claveToken(token)).catch(() => undefined);
    console.error("[recuperacion] No salió el correo de recuperación:", error);
  }
}

/** Cambia la contraseña si el token sigue vigente y lo inutiliza. */
export async function confirmarRecuperacion(token: string, password: string): Promise<void> {
  const clave = claveToken(token);
  const userId = await cacheRegistro.get(clave);
  if (!userId) {
    throw new AppError(
      400,
      "Este enlace ya no es válido. Pide uno nuevo.",
      "TOKEN_INVALIDO",
    );
  }

  // Se consume después del cambio: si el proveedor falla, el enlace sigue sirviendo.
  await actualizarContrasena(userId, password);
  await cacheRegistro.del(clave);
}
