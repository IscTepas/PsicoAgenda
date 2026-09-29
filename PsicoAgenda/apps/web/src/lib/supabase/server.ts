import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para el servidor (route handlers y Server Components).
 *
 * La sesión viaja en cookies httpOnly, que es lo que permite que `proxy.ts` verifique
 * la identidad real en el middleware en lugar de confiar en un valor de `localStorage`
 * modificable desde el navegador.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components no pueden escribir cookies. El middleware refresca la
            // sesión, así que se ignora sin propagar el error.
          }
        },
      },
    },
  );
}
