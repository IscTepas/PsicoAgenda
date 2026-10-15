import { DEFAULT_API_PORT } from "@psicoagenda/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${DEFAULT_API_PORT}`;

const API_PREFIX = "/api";

function buildApiUrl(path: string): string {
  // Normalizar: si el caller ya incluyó /api, no duplicar.
  const normalizedPath = path.startsWith(API_PREFIX) ? path : `${API_PREFIX}${path}`;
  return `${API_URL}${normalizedPath}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /**
   * Credencial de acceso de la sesión. Si se omite se resuelve desde el proveedor de
   * identidad, de modo que las rutas protegidas nunca viajan anónimas por descuido.
   */
  token?: string;
  body?: unknown;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Resuelve la credencial de acceso vigente en el navegador, leyéndola del cliente
 * compartido de Supabase.
 *
 * En el servidor devuelve `null` a propósito: este módulo también entra en el grafo
 * de los Client Components, así que no puede depender de `@/lib/supabase/server`
 * (que importa `next/headers`, prohibido fuera de Server Components). Los Server
 * Components inyectan la credencial explícitamente (`token`), resuelta por
 * `@/lib/api-client.server`.
 */
async function resolveAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const { createClient } = await import("@/lib/supabase/client");
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Cliente HTTP mínimo sobre fetch. Entiende el formato de error de la API
 * (`{ error: { code, message, details } }`) y lanza `ApiError` con ese código.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, body, headers, ...rest } = options;
  const accessToken = token ?? (await resolveAccessToken());

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
