"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { z } from "zod"
import { passwordSchema } from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormField,
  FormItem,
} from "@/components/ui/form"
import { Input as MotionInput } from "@/components/motion/input"
import { NewPasswordInput } from "@/components/new-password-input"
import { createClient } from "@/lib/supabase/client"
import { withTimeout } from "@/lib/with-timeout"
import { cn } from "@/lib/utils"
import { KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react"

const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

type NewPasswordValues = z.infer<typeof newPasswordSchema>

// El canje del código del enlace es una petición de red; no esperamos para siempre.
const LINK_CHECK_TIMEOUT_MS = 8000

type LinkState = "checking" | "ready" | "invalid" | "done"

const CARD =
  "flex w-full max-w-[420px] flex-col gap-6 rounded-4xl border border-border bg-card p-7 shadow-sm sm:p-9"

function StateHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof KeyRound
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-in zoom-in-75 duration-300">
        <Icon className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function NewPasswordForm() {
  const router = useRouter()
  const [linkState, setLinkState] = useState<LinkState>("checking")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })
  const password = useWatch({ control: form.control, name: "password" }) ?? ""
  const confirmPassword = useWatch({ control: form.control, name: "confirmPassword" }) ?? ""

  // El cliente de Supabase canjea solo el código del enlace al iniciar; aquí
  // esperamos a que termine y vemos si quedó una sesión de recuperación.
  useEffect(() => {
    let cancelled = false

    async function verifyLink() {
      const params = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const linkError = params.get("error") ?? hashParams.get("error")

      let hasSession = false
      if (!linkError) {
        try {
          const { data } = await withTimeout(createClient().auth.getSession(), LINK_CHECK_TIMEOUT_MS)
          hasSession = Boolean(data.session)
        } catch {
          hasSession = false
        }
      }

      if (!cancelled) setLinkState(hasSession ? "ready" : "invalid")
    }

    void verifyLink()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(values: NewPasswordValues) {
    setError(null)
    setIsPending(true)

    const { error: updateError } = await createClient().auth.updateUser({ password: values.password })

    setIsPending(false)

    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "La nueva contraseña debe ser distinta a la anterior."
          : updateError.code === "weak_password"
            ? "Esa contraseña es muy fácil de adivinar. Prueba con otra."
            : "No se pudo guardar la contraseña. Inténtalo de nuevo.",
      )
      return
    }

    setLinkState("done")
  }

  if (linkState === "checking") {
    return (
      <div className={cn(CARD, "items-center py-14 text-center")} role="status">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando tu enlace…</p>
      </div>
    )
  }

  if (linkState === "invalid") {
    return (
      <div className={cn(CARD, "animate-in fade-in duration-300")}>
        <StateHeader
          icon={KeyRound}
          title="Este enlace ya no es válido"
          description="Los enlaces de recuperación caducan y solo funcionan una vez. Pide uno nuevo y ábrelo en este mismo navegador."
        />
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href="/recuperar">Pedir un enlace nuevo</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (linkState === "done") {
    return (
      <div className={cn(CARD, "animate-in fade-in duration-300")}>
        <StateHeader
          icon={ShieldCheck}
          title="Contraseña actualizada"
          description="Listo. Desde ahora inicia sesión con tu nueva contraseña."
        />
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            router.push("/dashboard")
            router.refresh()
          }}
        >
          Ir a mi panel
        </Button>
      </div>
    )
  }

  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password

  return (
    <div className={cn(CARD, "animate-in fade-in duration-300")}>
      <StateHeader
        icon={KeyRound}
        title="Crea tu nueva contraseña"
        description="Elige una que no hayas usado antes en PsicoAgenda."
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                {/* Campo con medidor de seguridad (mismo que el registro); el ojo también muestra la confirmación. */}
                <NewPasswordInput
                  id="nueva-password"
                  label="Nueva contraseña"
                  name={field.name}
                  inputRef={field.ref}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  revealed={showPassword}
                  onRevealedChange={setShowPassword}
                  disabled={isPending}
                  autoFocus
                />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <FormItem>
                <MotionInput
                  ref={field.ref}
                  id="nueva-confirm-password"
                  name={field.name}
                  label="Confirmar contraseña"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repite tu nueva contraseña"
                  leftIcon={<Lock />}
                  disabled={isPending}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  success={passwordsMatch}
                />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar contraseña"
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
