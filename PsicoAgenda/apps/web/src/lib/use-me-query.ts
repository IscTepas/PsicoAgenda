"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionUser } from "@psicoagenda/shared";
import { apiFetch } from "@/lib/api-client";

export const ME_QUERY_KEY = ["auth", "me"] as const;

export const ME_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Perfil autenticado cacheado en el cliente. La primera llamada dispara
 * `/api/auth/me`; las siguientes lecturas dentro de `staleTime` reutilizan el
 * resultado sin tocar la red. La caché se invalida explícitamente al cerrar
 * sesión o actualizar el perfil.
 */
export function useMeQuery(token?: string | null) {
  return useQuery<SessionUser>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<SessionUser>("/auth/me", { token: token ?? undefined }),
    staleTime: ME_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    // No tiene sentido pedir el perfil si no hay token disponible.
    enabled: token !== null && token !== undefined,
  });
}

/**
 * Fuerza una nueva lectura del perfil cuando el usuario actualiza sus datos o
 * cierra sesión.
 */
export function useInvalidateMe() {
  const queryClient = useQueryClient();

  return {
    invalidateMe: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
    removeMe: () => queryClient.removeQueries({ queryKey: ME_QUERY_KEY }),
  };
}
