import Link from "next/link"
import { APP_NAME } from "@psicoagenda/shared"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { RegisterForm } from "./register-form"

export const metadata = {
  title: `Crear cuenta | ${APP_NAME}`,
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Apple Minimalist Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 sm:py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all"
        >
          <ArrowLeft className="size-3.5" />
          <span>Volver al inicio</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
          <div className="size-5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-bold flex items-center justify-center">
            Ψ
          </div>
          <span>{APP_NAME}</span>
        </div>
      </header>

      {/* Center Auth Card Container */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10">
        <RegisterForm />
      </main>

      {/* Apple Security & Privacy Footer */}
      <footer className="w-full max-w-xl mx-auto py-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <ShieldCheck className="size-3.5 text-[#0071E3]" />
          <span>Registro clínico seguro • Cumplimiento LFPDPPP</span>
        </div>
      </footer>
    </div>
  )
}
