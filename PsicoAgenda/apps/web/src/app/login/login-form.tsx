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

import { Eye, EyeOff } from "lucide-react"

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
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="w-full max-w-[420px] rounded-[28px] bg-card p-7 sm:p-9 border border-border shadow-sm flex flex-col gap-6">
      {/* Cabecera con isotipo verde y blanco de PsicoAgenda */}
      <div className="text-center flex flex-col items-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold shadow-2xs mb-3">
          Ψ
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Iniciar Sesión
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Ingresa tus credenciales para acceder a {APP_NAME}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
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
          {/* Campo Correo Electrónico */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Correo electrónico
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="tu@correo.com"
                    autoComplete="username"
                    className="h-10 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Campo Contraseña con opción Ocultar/Mostrar */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contraseña
                  </FormLabel>
                </div>
                <div className="relative flex items-center">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-10 pr-10 rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Enlace: Olvidé mi contraseña */}
          <div className="flex justify-end pt-0.5">
            <Link
              href="/recuperar"
              className="text-xs font-medium text-primary hover:underline"
            >
              ¿Olvidé mi contraseña?
            </Link>
          </div>

          {/* Botón Principal: Iniciar Sesión */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-11 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all"
            disabled={isPending || !configured}
          >
            {isPending ? "Validando credenciales..." : "Iniciar Sesión"}
          </Button>
        </form>
      </Form>

      {/* Separador */}
      <div className="relative my-1 text-center">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-border" />
        </div>
        <span className="relative bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
          o
        </span>
      </div>

      {/* Botón Secundario: Crear cuenta nueva */}
      <Button
        variant="outline"
        size="lg"
        asChild
        className="w-full h-11 rounded-xl text-sm font-semibold border-border hover:bg-muted text-foreground"
      >
        <Link href="/registro">
          Crear cuenta nueva
        </Link>
      </Button>

      {/* Cuentas de demostración en modo development */}
      {process.env.NODE_ENV === "development" && demoAccounts.length > 0 ? (
        <div className="rounded-2xl bg-primary/5 p-3.5 border border-primary/20 space-y-2 mt-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Cuentas Demo (1-clic)
            </span>
            <span className="text-[10px] text-muted-foreground">Desarrollo</span>
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
                className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border shadow-2xs hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all text-left group"
              >
                <div className="min-w-0 pr-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {account.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {account.email}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground px-2 py-0.5 rounded-full shrink-0 transition-colors">
                  Usar
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}


