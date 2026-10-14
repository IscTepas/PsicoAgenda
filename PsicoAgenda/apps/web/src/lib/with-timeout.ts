export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message)
    this.name = "TimeoutError"
  }
}

/**
 * El SDK de Supabase no expone ningún `retryAttempts`/timeout configurable: un
 * refresh de sesión contra un proyecto inalcanzable reintenta con backoff
 * exponencial hasta un techo interno de 30s. Este valor acota cuánto esperamos
 * antes de tratar la sesión como no disponible (fallo cerrado), sin cancelar
 * el intento de fondo del SDK.
 */
export const AUTH_CHECK_TIMEOUT_MS = 4000

/** Cookie(s) de sesión de Supabase (incluye fragmentos `.0`, `.1`, … si la
 *  sesión fue chunkeada). No matchea `-code-verifier` ni `-user`. */
export const STALE_SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

/**
 * Deja de esperar `promise` tras `ms` milisegundos, rechazando con
 * `TimeoutError`. No cancela `promise`: el SDK no expone un `AbortSignal` en
 * su loop interno de reintentos, así que solo dejamos de esperarla.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number = AUTH_CHECK_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`Timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
