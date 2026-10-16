import Link from "next/link"
import Image from "next/image"
import { APP_NAME } from "@psicoagenda/shared"
import { Wordmark } from "@/components/brand/wordmark"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { RegisterForm } from "./register-form"

export const metadata = {
  title: `Crear cuenta | ${APP_NAME}`,
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 sm:py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Volver al inicio</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <Image src="/images/psicoagenda-icon.png" alt="" width={36} height={32} className="h-8 w-9 object-contain" />
          <Wordmark className="text-sm" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10">
        <RegisterForm />
      </main>

      {/* Security Footer */}
      <footer className="w-full max-w-xl mx-auto py-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Registro clínico seguro • Cumplimiento LFPDPPP</span>
        </div>
      </footer>
    </div>
  )
}
