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
    <>
      <Link href="/" className="mb-6 text-2xl font-bold text-primary">
        {APP_NAME}
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Iniciar sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!configured ? (
            <Alert variant="destructive">
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
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tu@correo.com"
                        autoComplete="email"
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
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isPending || !configured}>
                {isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Form>

          {/*
            Cuentas de prueba. El gate es `process.env.NODE_ENV`, no una variable
            NEXT_PUBLIC_: Next la sustituye por una constante al compilar, asi que en
            produccion la comparacion es `false` y este JSX desaparece del bundle. Con
            un flag NEXT_PUBLIC_ el bloque se publicaria en cualquier build.
            Ver `src/lib/demo-accounts.ts` para de donde salen las credenciales.
          */}
          {process.env.NODE_ENV === "development" && demoAccounts.length > 0 ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-xs text-muted-foreground">
                Cuentas de prueba. No existen en un build de produccion.
              </p>
              {demoAccounts.map((account) => (
                <div
                  key={account.email}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{account.label}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {account.email} · {account.password} · {account.navItems} ítems
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", account.email)
                      form.setValue("password", account.password)
                    }}
                  >
                    Usar
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-primary hover:underline">
              Regístrate
            </Link>
          </p>
        </CardFooter>
      </Card>

      <Button variant="link" asChild className="mt-4">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </>
  )
}


