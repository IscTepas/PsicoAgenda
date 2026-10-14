"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
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
import { ArrowUpRight, Loader2, MailCheck } from "lucide-react"

const recoverSchema = z.object({
  email: emailSchema,
})

type RecoverValues = z.infer<typeof recoverSchema>

// Supabase limita el reenvío del correo de recuperación a uno por minuto.
const RESEND_COOLDOWN_SECONDS = 60

// Atajo a la bandeja del proveedor más común según el dominio del correo.
const MAIL_PROVIDERS: { domains: string[]; label: string; url: string }[] = [
  { domains: ["gmail.com", "googlemail.com"], label: "Gmail", url: "https://mail.google.com/" },
  {
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.es", "hotmail.es"],
    label: "Outlook",
    url: "https://outlook.live.com/mail/",
  },
  { domains: ["yahoo.com", "yahoo.com.mx", "yahoo.es"], label: "Yahoo Mail", url: "https://mail.yahoo.com/" },
  { domains: ["icloud.com", "me.com", "mac.com"], label: "iCloud Mail", url: "https://www.icloud.com/mail" },
]

function findMailProvider(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  return MAIL_PROVIDERS.find((provider) => provider.domains.includes(domain)) ?? null
}

const NEXT_STEPS = [
  "Abre el correo de PsicoAgenda.",
  "Toca el enlace para restablecer.",
  "Crea tu nueva contraseña.",
]

export function RecoverForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [resent, setResent] = useState(false)
  const configured = isSupabaseConfigured()

  const form = useForm<RecoverValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  })

  // Cuenta regresiva del reenvío: un tick por segundo mientras quede tiempo.
  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])

  async function sendResetLink(email: string): Promise<boolean> {
    setError(null)
    setIsPending(true)

    // Supabase no revela si el correo existe: siempre resuelve con éxito para
    // no permitir enumerar cuentas registradas a partir de este formulario.
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar/nueva`,
    })

    setIsPending(false)

    if (resetError) {
      setError(
        resetError.status === 429
          ? "Ya enviamos un enlace hace poco. Espera un minuto antes de pedir otro."
          : "No se pudo enviar el enlace. Inténtalo de nuevo.",
      )
      return false
    }

    setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    return true
  }

  async function onSubmit(values: RecoverValues) {
    if (await sendResetLink(values.email)) {
      setResent(false)
      setSubmittedEmail(values.email)
    }
  }

  async function handleResend() {
    if (submittedEmail && (await sendResetLink(submittedEmail))) {
      setResent(true)
    }
  }

  function changeEmail() {
    setSubmittedEmail(null)
    setError(null)
    setResent(false)
  }

  if (submittedEmail) {
    const provider = findMailProvider(submittedEmail)

    return (
      <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[28px] border border-border bg-card p-7 shadow-sm animate-in fade-in duration-300 sm:p-9">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-in zoom-in-75 duration-300">
            <MailCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Revisa tu correo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Si hay una cuenta con este correo, te enviamos un enlace para crear una contraseña nueva.
          </p>
          <p className="mt-3 max-w-full truncate rounded-full bg-muted px-3.5 py-1.5 text-sm font-medium text-foreground">
            {submittedEmail}
          </p>
        </div>

        {/* Qué sigue, en tres pasos */}
        <ol className="space-y-3 rounded-2xl bg-muted/40 p-4">
          {NEXT_STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3 text-sm text-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold tabular-nums text-primary shadow-2xs">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {error ? (
          <Alert variant="destructive" className="rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          {provider ? (
            <Button asChild size="lg" className="w-full">
              <a href={provider.url} target="_blank" rel="noopener noreferrer">
                Abrir {provider.label}
                <ArrowUpRight />
              </a>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={provider ? "outline" : "default"} className="w-full">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>

        {/* Reenvío con cuenta regresiva + cambiar de correo */}
        <div className="space-y-1 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          <p aria-live="polite">
            {resent && secondsLeft > 0 ? "Enlace reenviado. " : "¿No te llegó? Revisa tu carpeta de spam"}
            {secondsLeft > 0 ? (
              <>
                {resent ? "" : ". "}
                <span className="tabular-nums">
                  Podrás reenviarlo en 0:{String(secondsLeft).padStart(2, "0")}
                </span>
              </>
            ) : (
              <>
                {" o "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isPending}
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {isPending ? "reenviando…" : "reenvía el enlace"}
                </button>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={changeEmail}
            className="font-medium text-foreground/80 hover:text-foreground hover:underline"
          >
            Usar otro correo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[28px] border border-border bg-card p-7 shadow-sm sm:p-9">
      {/* Cabecera con el logo de PsicoAgenda */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/images/psicoagenda-logo.png"
          alt={APP_NAME}
          width={167}
          height={116}
          className="mb-1 h-[116px] w-[167px] object-contain"
          priority
        />
        <p className="mt-1 text-sm font-semibold text-foreground/80">¿Olvidaste tu contraseña?</p>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Escribe el correo con el que te registraste y te enviaremos un enlace para crear una nueva.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
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
            className="h-11 w-full rounded-xl text-sm font-semibold"
            disabled={isPending || !configured}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Enviando enlace…
              </>
            ) : (
              "Enviar enlace"
            )}
          </Button>
        </form>
      </Form>

      <div className="border-t border-border pt-1 text-center">
        <p className="pt-4 text-sm text-muted-foreground">
          ¿Ya la recordaste?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
