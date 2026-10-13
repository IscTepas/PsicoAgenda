import Link from "next/link"
import { APP_NAME } from "@psicoagenda/shared"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { RecoverForm } from "./recover-form"

export const metadata = {
  title: `Recuperar contraseña | ${APP_NAME}`,
}

export default function RecuperarPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 sm:py-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Volver al inicio de sesión</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <div className="size-6 rounded-md bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
            Ψ
          </div>
          <span>{APP_NAME}</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10">
        <RecoverForm />
      </main>

      {/* Security Footer */}
      <footer className="w-full max-w-md mx-auto py-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Acceso seguro • {APP_NAME}</span>
        </div>
      </footer>
    </div>
  )
}
