import { ApiError, apiFetch } from "@/lib/api-client"

/**
 * Recuperación de contraseña: la API manda el enlace con su propio mailer y
 * cambia la contraseña con el token. El navegador ya no habla con Supabase aquí.
 */
export const recuperacionService = {
  solicitar: (email: string) =>
    apiFetch<{ ok: true }>("/auth/recuperacion/solicitar", { method: "POST", body: { email } }),

  confirmar: (token: string, password: string) =>
    apiFetch<{ ok: true }>("/auth/recuperacion/confirmar", { method: "POST", body: { token, password } }),
}

/** ¿El error dice que el enlace ya no sirve (usado o vencido)? */
export const esEnlaceInvalido = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "TOKEN_INVALIDO"

export function mensajeDeRecuperacion(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return "Pediste varios enlaces seguidos. Espera unos minutos antes de pedir otro."
  }
  return "No se pudo completar la solicitud. Inténtalo de nuevo."
}
