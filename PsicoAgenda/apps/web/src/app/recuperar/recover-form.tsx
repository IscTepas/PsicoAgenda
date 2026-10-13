"use client"

import Link from "next/link"
import { useState } from "react"
import { z } from "zod"
import { emailSchema, APP_NAME } from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { CheckCircle2, Loader2 } from "lucide-react"

const recoverSchema = z.object({
  email: emailSchema,
})

type RecoverValues = z.infer<typeof recoverSchema>

export function RecoverForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const configured = isSupabaseConfigured()

  const form = useForm<RecoverValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: RecoverValues) {
    setError(null)
    setIsPending(true)

    // Supabase no revela si el correo existe: siempre resuelve con éxito para
    // no permitir enumerar cuentas registradas a partir de este formulario.
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(
      values.email,
      { redirectTo: `${window.location.origin}/login` },
    )

    if (resetError) {
      setError("No se pudo procesar la solicitud. Inténtalo nuevamente.")
      setIsPending(false)
      return
    }

    setIsPending(false)
    setSubmittedEmail(values.email)
  }

  if (submittedEmail) {
    return (
      <div className="w-full max-w-[420px] rounded-[28px] bg-card p-7 sm:p-9 border border-border shadow-sm text-center flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Enlace de recuperación enviado
        </h1>
        <p className="text-sm text-muted-foreground">
          Si el correo está registrado, enviamos un enlace de restablecimiento a:
        </p>
        <p className="font-semibold text-foreground text-sm bg-muted/60 px-4 py-2 rounded-xl break-all">
          {submittedEmail}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
          El enlace tiene vigencia limitada. Revisa tu carpeta de correo no deseado si no lo encuentras en tu bandeja de entrada.
        </p>
        <div className="w-full flex flex-col gap-2 pt-3">
          <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl">
            <Link href="/login">Regresar al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px] rounded-[28px] bg-card p-7 sm:p-9 border border-border shadow-sm flex flex-col gap-6">
      {/* Cabecera con isotipo verde y blanco de PsicoAgenda */}
      <div className="text-center flex flex-col items-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold shadow-2xs mb-3">
          Ψ
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/80">
          Recuperar Contraseña
        </p>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Ingresa tu correo electrónico registrado y te enviaremos un enlace de restablecimiento con vigencia limitada.
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
                    autoFocus
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
            className="w-full h-11 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all"
            disabled={isPending || !configured}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enviando enlace...
              </>
            ) : (
              "Enviar enlace de recuperación"
            )}
          </Button>
        </form>
      </Form>

      <div className="text-center pt-1 border-t border-border">
        <p className="pt-4 text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Regresar al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
