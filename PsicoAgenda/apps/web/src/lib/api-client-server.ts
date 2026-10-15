import { DEFAULT_API_PORT } from "@psicoagenda/shared";
import { createClient } from "@/lib/supabase/server";
import { ApiError, type RequestOptions } from "@/lib/api-client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${DEFAULT_API_PORT}`;

const API_PREFIX = "/api";

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith(API_PREFIX) ? path : `${API_PREFIX}${path}`;
  return `${API_URL}${normalizedPath}`;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Cliente HTTP para Server Components y Route Handlers. Obtiene la sesión del
 * cliente servidor de Supabase, que a su vez lee las cookies httpOnly.
 */
export async function apiFetchServer<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, body, headers, ...rest } = options;

  let accessToken = token ?? undefined;
  if (!accessToken) {
    const client = await createClient();
    const { data } = await client.auth.getSession();
    accessToken = data.session?.access_token ?? undefined;
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const apiError = (payload as ApiErrorBody | undefined)?.error;
    throw new ApiError(
      response.status,
      apiError?.code ?? "UNKNOWN_ERROR",
      apiError?.message ?? `Error ${response.status} al llamar a ${path}`,
      apiError?.details,
    );
  }

  return payload as T;
}

export { ApiError };
