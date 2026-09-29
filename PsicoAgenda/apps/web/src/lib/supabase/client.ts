import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

let browserClient: SupabaseClient | undefined;

/**
 * Cliente compartido de Supabase para el navegador.
 *
 * La clave publicable solo habilita la Auth API: la Data API del proyecto está
 * desactivada, así que desde el cliente no se puede leer ninguna tabla de `public`.
 * El acceso a los datos de dominio pasa por la API con el token de sesión.
 */
export function createClient(): SupabaseClient {
  browserClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  return browserClient;
}
