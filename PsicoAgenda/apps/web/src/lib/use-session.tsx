"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { readIdentity } from "@/lib/session";

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

    if (!initialUser) {
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user);
        setIsLoading(false);
      });
    }

    // `INITIAL_SESSION` cubre la restauración; `TOKEN_REFRESHED` y `SIGNED_OUT` cubren
    // la renovación transparente y el cierre de sesión en otras pestañas.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
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
