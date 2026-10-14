"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { readIdentity } from "@/lib/session";
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
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [isConfigured, initialUser]);

  const logout = React.useCallback(async () => {
    if (!isConfigured) return;
    await createClient().auth.signOut();
    setUser(null);
  }, [isConfigured]);

  const value = React.useMemo<SessionContextValue>(
    () => ({ user: readIdentity(user), isLoading, isConfigured, logout }),
    [user, isLoading, isConfigured, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
