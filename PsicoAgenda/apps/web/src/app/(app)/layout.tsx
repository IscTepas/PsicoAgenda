import { AppShell } from "./components/app-shell"
import { SessionProvider } from "@/lib/use-session"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-background">
        <AppShell>{children}</AppShell>
      </div>
    </SessionProvider>
  )
}
