import { AppShell } from "./components/app-shell"
import { SessionProvider } from "@/lib/use-session"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Hidratar el cliente con el usuario obtenido en SSR evita que el navegador
  // vuelva a llamar `getUser()` durante la hidratación.
  let initialUser = null

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      initialUser = user
    } catch {
      // Ignore during build or when unauthenticated
    }
  }

  return (
    <SessionProvider initialUser={initialUser}>
      <div className="flex min-h-screen bg-background">
        <AppShell>{children}</AppShell>
      </div>
    </SessionProvider>
  )
}
