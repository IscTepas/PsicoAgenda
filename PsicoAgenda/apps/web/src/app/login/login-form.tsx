"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { z } from "zod"
import { emailSchema, APP_NAME } from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { demoAccounts } from "@/lib/demo-accounts"

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es obligatoria"),
})

type LoginValues = z.infer<typeof loginSchema>

const AUTH_ERRORS: Record<string, string> = {
  InvalidCredentialsError: "Correo o contraseña incorrectos",
  EmailNotConfirmedError:
    "Tu correo aún no está verificado. Revisa el mensaje que te enviamos al registrarte.",
  EmailPasswordMismatchError: "Correo o contraseña incorrectos",
}

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const configured = isSupabaseConfigured()

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setError(null)
    setIsPending(true)

    // El proveedor de identidad verifica la credencial y emite la sesión; la API
    // nunca ve la contraseña ni emite tokens.
    const { error: signInError } = await createClient().auth.signInWithPassword(values)

    if (signInError) {
      setError(AUTH_ERRORS[signInError.name] ?? "No se pudo iniciar sesión. Intenta de nuevo.")
      setIsPending(false)
      return
    }

    // `refresh` con `redirect: false` deja que proxy.ts valide la sesión ya
    // renovada en la cookie antes de resolver la navegación.
    await createClient().auth.refreshSession()
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="w-full max-w-[420px] rounded-[32px] bg-white dark:bg-[#1C1C1E] p-7 sm:p-9 border border-black/[0.06] dark:border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col gap-6">
      {/* Apple App Symbol & Header */}
      <div className="text-center flex flex-col items-center">
        <div className="flex size-14 items-center justify-center rounded-[20px] bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-2xl font-bold shadow-md mb-4 transition-transform active:scale-95">
          Ψ
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Iniciar sesión
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
          Accede con tu ID a la consulta de {APP_NAME}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!configured ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>
            Faltan <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en{" "}
            <code>apps/web/.env</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Correo electrónico
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="ejemplo@psicoagenda.com"
                    autoComplete="email"
                    className="h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.04]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Contraseña
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.04]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full h-11 rounded-full text-[15px] font-medium bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm hover:shadow active:scale-[0.98] transition-all mt-2"
            disabled={isPending || !configured}
          >
            {isPending ? "Validando credenciales..." : "Continuar"}
          </Button>
        </form>
      </Form>

      {/* Cuentas de demostración en modo development */}
      {process.env.NODE_ENV === "development" && demoAccounts.length > 0 ? (
        <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-3.5 border border-black/[0.05] dark:border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Acceso Rápido Demo (1-clic)
            </span>
            <span className="text-[10px] text-neutral-400">Desarrollo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  form.setValue("email", account.email)
                  form.setValue("password", account.password)
                }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] shadow-2xs hover:border-[#0071E3]/50 hover:bg-[#0071E3]/5 active:scale-[0.97] transition-all text-left group"
              >
                <div className="min-w-0 pr-1">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                    {account.label}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">
                    {account.email}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/10 group-hover:bg-[#0071E3] group-hover:text-white px-2 py-0.5 rounded-full shrink-0 transition-colors">
                  Usar
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Link de Registro */}
      <div className="text-center pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
          ¿No tienes una cuenta de consulta?{" "}
          <Link
            href="/registro"
            className="font-medium text-[#0071E3] hover:underline"
          >
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  )
}


