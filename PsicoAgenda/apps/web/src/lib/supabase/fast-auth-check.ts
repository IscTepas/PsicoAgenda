import { combineChunks, stringFromBase64URL } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

const BASE64_PREFIX = "base64-"

function getStorageKey(supabaseUrl: string): string {
  const ref = new URL(supabaseUrl).hostname.split(".")[0]
  return `sb-${ref}-auth-token`
}

async function readAccessTokenFromCookies(
  storageKey: string,
  getCookie: (name: string) => string | undefined,
): Promise<string | null> {
  const raw = await combineChunks(storageKey, async (name) => getCookie(name) ?? null)
  if (!raw) return null

  const decoded = raw.startsWith(BASE64_PREFIX) ? stringFromBase64URL(raw.slice(BASE64_PREFIX.length)) : raw

  try {
    const session = JSON.parse(decoded) as { access_token?: unknown }
    return typeof session.access_token === "string" ? session.access_token : null
  } catch {
    return null
  }
}

export type FastAuthUser = { id: string; email: string }

/**
 * Vía rápida: valida la sesión localmente (firma + expiración) sin llamar a
 * `getSession()`/`getUser()`, leyendo el access_token directo de la cookie y
 * verificándolo con `getClaims()`. Esto evita el refresh-retry de hasta 30s
 * del SDK cuando el proveedor de identidad es inalcanzable, para el caso
 * común de un token que sigue vigente.
 *
 * Devuelve `null` ante cualquier fallo (token ausente, expirado, inválido) —
 * el llamador debe caer entonces al camino existente (`getUser()`), que es
 * la única vía que puede refrescar una sesión de verdad.
 */
export async function tryFastAuthCheck(
  supabase: SupabaseClient,
  supabaseUrl: string,
  getCookie: (name: string) => string | undefined,
): Promise<FastAuthUser | null> {
  const token = await readAccessTokenFromCookies(getStorageKey(supabaseUrl), getCookie)
  if (!token) return null

  const { data, error } = await supabase.auth.getClaims(token)
  if (error || !data) return null

  return { id: data.claims.sub, email: data.claims.email ?? "" }
}
