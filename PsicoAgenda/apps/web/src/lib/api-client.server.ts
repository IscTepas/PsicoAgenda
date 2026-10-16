import { createClient } from "@/lib/supabase/server";

/**
 * Resuelve la credencial de acceso para llamadas a la API hechas desde Server
 * Components.
 *
 * Vive en un módulo aparte (y no en `api-client.ts`) porque `@/lib/supabase/server`
 * importa `next/headers`: incluirlo en `api-client.ts` arrastraría esa API al grafo
 * de los Client Components y rompería el build. Los Server Components llaman a este
 * helper y pasan el resultado como `token` a los servicios.
 */
export async function getServerAccessToken(): Promise<string | null> {
  const client = await createClient();
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
