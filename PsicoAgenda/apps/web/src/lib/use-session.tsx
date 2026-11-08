"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { readIdentity } from "@/lib/session";
import { useMeQuery, ME_QUERY_KEY } from "@/lib/use-me-query";
import { withTimeout, TimeoutError, STALE_SUPABASE_AUTH_COOKIE, AUTH_CHECK_TIMEOUT_MS } from "@/lib/with-timeout";

/**
 * Borra las cookies de sesión que quedaron caducas tras un timeout de red: sin
 * esto, cada carga futura volvería a pagar el mismo costo de reintentos del
 * SDK contra un proveedor inalcanzable.
 */
function clearStaleAuthCookies() {
  document.cookie.split("; ").forEach((entry) => {
    const name = entry.split("=")[0];
    if (name && STALE_SUPABASE_AUTH_COOKIE.test(name)) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  });
}

interface SessionContextValue {
  /** Identidad y perfil derivados de la sesión del proveedor. `null` sin sesión. */
  user: ReturnType<typeof readIdentity>;
  isLoading: boolean;
  /** `false` cuando faltan `NEXT_PUBLIC_SUPABASE_*`: permite avisar en vez de fallar en silencio. */
  isConfigured: boolean;
  logout: () => Promise<void>;
  /** Actualiza la foto del menú sin recargar (tras guardar el perfil). */
  updatePhoto: (photoUrl?: string) => void;
  /** Token de acceso vigente, resuelto una sola vez para evitar múltiples `getSession()`. */
  accessToken: string | null;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  const isConfigured = isSupabaseConfigured();
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = React.useState(!initialUser && isConfigured);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    // `isConfigured` no cambia en tiempo de ejecución: si falta configuración,
    // `isLoading` ya nació en `false` y no hay nada que sincronizar.
    if (!isConfigured) return;

    const supabase = createClient();
    let cancelled = false;

    if (!initialUser) {
      // Acotado con timeout: sin él, un refresh de sesión contra un proveedor
      // inalcanzable reintenta con backoff exponencial hasta 30s, dejando
      // `isLoading` colgado ese tiempo en cada carga de la app.
      withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS)
        .then(({ data }) => {
          if (cancelled) return;
          setUser(data.user);
          setIsLoading(false);
        })
        .catch((error) => {
          if (cancelled) return;
          if (error instanceof TimeoutError) {
            // No usar supabase.auth.signOut() aquí: internamente vuelve a
            // llamar __loadSession()/_callRefreshToken() sobre la misma
            // cookie caduca y reproduce el mismo colgado. Se borra la cookie
            // directamente para que la próxima carga ya no tenga nada que
            // reintentar.
            clearStaleAuthCookies();
          }
          setUser(null);
          setIsLoading(false);
        });
    }

    // `INITIAL_SESSION` cubre la restauración; `TOKEN_REFRESHED` y `SIGNED_OUT` cubren
    // la renovación transparente y el cierre de sesión en otras pestañas.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setIsLoading(false);
    });

    // Si no hay usuario inicial, resolvemos el token una sola vez para no repetir
    // `getSession()` en cada `apiFetch` cuando varias queries corren en paralelo.
    // Cuando hay `initialUser`, evitamos la segunda llamada al proveedor: el
    // primer evento de `onAuthStateChange` (INITIAL_SESSION) traerá el token.
    if (!initialUser) {
      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setAccessToken(data.session?.access_token ?? null);
      });
    }

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [isConfigured, initialUser]);

  const logout = React.useCallback(async () => {
    if (!isConfigured) return;
    await createClient().auth.signOut();
    setUser(null);
    setAccessToken(null);
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
  }, [isConfigured, queryClient]);

  // Perfil de la API, cacheado con React Query. El token inyectado evita que
  // cada llamada a `apiFetch` vuelva a pedir la sesión a Supabase.
  const { data: profile, isLoading: isProfileLoading } = useMeQuery(accessToken);

  const photoUrl = profile?.photoUrl;
  const profileName = profile?.name;

  const updatePhoto = React.useCallback(
    (next?: string) => {
      queryClient.setQueryData<ReturnType<typeof readIdentity>>(ME_QUERY_KEY, (old) => {
        if (!old) return old;
        return { ...old, photoUrl: next };
      });
    },
    [queryClient],
  );

  const value = React.useMemo<SessionContextValue>(() => {
    const identity = readIdentity(user);

    return {
      user: identity
        ? {
            ...identity,
            name: profileName || identity.name,
            photoUrl: photoUrl ?? identity.photoUrl,
          }
        : null,
      isLoading: isLoading || isProfileLoading,
      isConfigured,
      logout,
      updatePhoto,
      accessToken,
    };
  }, [user, photoUrl, profileName, isLoading, isProfileLoading, isConfigured, logout, updatePhoto, accessToken]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
