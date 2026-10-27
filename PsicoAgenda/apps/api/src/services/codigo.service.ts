import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { MAX_INTENTOS_CODIGO } from "@psicoagenda/shared";
import {
  cacheRegistro,
  vaciarCacheRegistro,
  type CacheStore,
} from "@/services/codigo-cache.repo";
import { AppError } from "@/utils/app-error";

/**
 * Códigos de registro de usuario: no tocan la tabla de usuarios ni viajan al
 * cliente. Solo se persiste el hash SHA-256 del código, de modo que un volcado
 * de la base no permite recuperar el código de 6 dígitos.
 *
 * El almacén vive detrás de `CacheStore` (`codigo-cache.repo.ts`) y hoy es la
 * tabla `cache_registro` en Postgres. Antes era un `Map` del proceso, que dejó
 * de valer al pasar a serverless: con varias instancias, la verificación podía
 * caer en una lambda que nunca vio el código.
 */

/** Ventana de vida de un código: 10 minutos. */
export const CODIGO_TTL_SECONDS = 600;
/** Espera mínima entre envíos (cooldown de reenvío). */
export const REENVIO_COOLDOWN_SECONDS = 60;
/** Intentos de verificación fallidos antes de invalidar el código. */
export const MAX_INTENTOS = MAX_INTENTOS_CODIGO;
/** Solicitudes de pre-registro admitidas por IP... */
export const MAX_SOLICITUDES_POR_IP = 5;
/** ...dentro de esta ventana. */
export const RATE_VENTANA_SECONDS = 600;

// ---------------------------------------------------------------------------
// Cache: tabla `cache_registro`. Cada entrada lleva su propio vencimiento, así
// que no hace falta un cron aparte para expirar (el barrido del despacho borra
// las vencidas una vez por vuelta, y el `get` lo hace de forma perezosa).
// ---------------------------------------------------------------------------

/**
 * Único punto de acceso al almacén. La indirección se mantiene a propósito:
 * cambiar de Postgres a Redis es tocar solo `codigo-cache.repo.ts`.
 */
const obtenerCache = (): CacheStore => cacheRegistro;

// ---------------------------------------------------------------------------
// Claves y utilidades
// ---------------------------------------------------------------------------

const normalizar = (valor: string): string => valor.trim().toLowerCase();

const claveCod = (email: string): string => `registro:cod:${email}`;
const claveIntentos = (email: string): string => `registro:intentos:${email}`;
const claveReenvio = (email: string): string => `registro:reenvio:${email}`;
const claveRate = (ip: string): string => `registro:rate:${ip}`;

const sha256 = (valor: string): string =>
  createHash("sha256").update(valor).digest("hex");

const iguales = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

/** Genera un código de 6 dígitos (con ceros a la izquierda). */
const generar6Digitos = (): string =>
  String(randomInt(0, 1_000_000)).padStart(6, "0");

// ---------------------------------------------------------------------------
// API del servicio
// ---------------------------------------------------------------------------

/**
 * Cuenta cada solicitud de pre-registro por origen (IP) y rechaza por encima
 * del límite ANTES de tocar Supabase o el mailer. La IP se toma del primer
 * salto de `X-Forwarded-For` porque en desarrollo las llamadas pasan por el
 * proxy de Next.js (rewrite) y `req.ip` sería la misma para todos.
 */
export async function limitarSolicitudesPorIp(ip: string): Promise<void> {
  const origen = normalizar(ip || "desconocida");
  const solicitadas = await obtenerCache().incr(claveRate(origen), RATE_VENTANA_SECONDS);
  if (solicitadas > MAX_SOLICITUDES_POR_IP) {
    throw new AppError(
      429,
      "Demasiadas solicitudes de registro desde esta conexión. Intenta de nuevo más tarde.",
      "RATE_LIMIT",
      { retryAfterSeconds: RATE_VENTANA_SECONDS },
    );
  }
}

/**
 * Genera un código nuevo para el correo y lo guarda hasheado con TTL de 10
 * minutos. Aplica el cooldown de reenvío: solo existe UN código vigente por
 * correo (el anterior queda invalidado al generar otro).
 *
 * Devuelve el código en claro únicamente para que el mailer lo envíe; la cache
 * jamás lo almacena tal cual.
 */
export async function generarCodigo(email: string): Promise<string> {
  const destino = normalizar(email);
  const cache = obtenerCache();

  const enCooldown = await cache.get(claveReenvio(destino));
  if (enCooldown !== null) {
    throw new AppError(
      429,
      `Ya te enviamos un código hace poco. Espera ${REENVIO_COOLDOWN_SECONDS} segundos antes de pedir otro.`,
      "COOLDOWN",
      { retryAfterSeconds: REENVIO_COOLDOWN_SECONDS },
    );
  }

  const codigo = generar6Digitos();
  await cache.set(claveCod(destino), sha256(codigo), CODIGO_TTL_SECONDS);
  await cache.del(claveIntentos(destino));
  await cache.set(claveReenvio(destino), "1", REENVIO_COOLDOWN_SECONDS);
  return codigo;
}

/**
 * Valida el código sin consumirlo: el consumo ocurre recién cuando la cuenta
 * se creó (`consumirCodigo`), de modo que un fallo transitorio de Supabase no
 * deja al usuario sin código.
 */
export async function verificarCodigo(email: string, codigo: string): Promise<void> {
  const destino = normalizar(email);
  const cache = obtenerCache();

  const guardado = await cache.get(claveCod(destino));
  if (guardado === null) {
    throw new AppError(410, "El código expiró o no existe. Solicita uno nuevo.", "CODIGO_EXPIRADO");
  }

  const intentos = await cache.incr(claveIntentos(destino), CODIGO_TTL_SECONDS);
  if (intentos > MAX_INTENTOS) {
    await cache.del(claveCod(destino), claveIntentos(destino));
    throw new AppError(
      429,
      "Demasiados intentos fallidos. Solicita un código nuevo.",
      "CODIGO_AGOTADO",
    );
  }

  if (!iguales(guardado, sha256(normalizar(codigo)))) {
    throw new AppError(400, "El código es incorrecto.", "CODIGO_INVALIDO");
  }
}

/**
 * Borra las claves del código verificado (código, intentos y cooldown) para
 * que no quede ningún residuo tras el alta.
 */
export async function consumirCodigo(email: string): Promise<void> {
  const destino = normalizar(email);
  await obtenerCache().del(
    claveCod(destino),
    claveIntentos(destino),
    claveReenvio(destino),
  );
}

/** Vacía el almacén (solo para pruebas, que lo sustituyen por uno en memoria). */
export function limpiarCacheRegistro(): Promise<void> {
  return vaciarCacheRegistro();
}
