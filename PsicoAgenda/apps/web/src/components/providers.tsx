"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const CATALOG_STALE_TIME_MS = 2 * 60 * 1000; // 2 minutos para catálogos/perfil

export function Providers({ children }: { children: ReactNode }) {
  // useState evita recrear el cliente en cada render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Catálogos y perfil pueden cachearse más tiempo; los datos
            // clínicos transaccionales sobrescriben este valor a 30 s.
            staleTime: CATALOG_STALE_TIME_MS,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
