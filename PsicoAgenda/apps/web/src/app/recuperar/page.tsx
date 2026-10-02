"use client"

import { useState } from "react"
import Link from "next/link"
import { APP_NAME } from "@psicoagenda/shared"
import {
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function PantallaRecuperarContraseña() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setErrorMessage("Por favor, ingresa tu correo electrónico registrado.")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setErrorMessage("El formato de correo no es válido. Ejemplo: nombre@dominio.com")
      return
    }

    setIsSubmitting(true)

    // Simulación de envío con backend o Supabase Auth
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmittedEmail(trimmed)
    }, 900)
  }

  const handleReset = () => {
    setSubmittedEmail(null)
    setEmail("")
    setErrorMessage(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6">
      {/* Barra superior con navegación */}
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

      {/* Contenedor central */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-md">
          <Card className="border-border/80 shadow-sm rounded-2xl overflow-hidden">
            {submittedEmail ? (
              /* ESTADO DE ÉXITO */
              <div className="p-6 sm:p-8 space-y-6 text-center">
                <div className="mx-auto size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <CheckCircle2 className="size-7" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Enlace de recuperación enviado
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Hemos enviado un correo con instrucciones para restablecer tu acceso a:
                  </p>
                  <p className="text-sm font-semibold text-foreground bg-muted/50 py-1 px-3 rounded-lg inline-block break-all border border-border/60">
                    {submittedEmail}
                  </p>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/30 p-3.5 rounded-xl border border-border/40 text-left space-y-1.5">
                  <p className="font-medium text-foreground">¿No recibiste el mensaje?</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Revisa tu carpeta de correo no deseado (spam).</li>
                    <li>Verifica que el correo esté escrito correctamente.</li>
                    <li>El enlace expira en 60 minutos por seguridad.</li>
                  </ul>
                </div>

                <div className="space-y-2.5 pt-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-xs font-medium h-10 border-border/80"
                    onClick={handleReset}
                  >
                    <RefreshCw className="mr-2 size-3.5" />
                    Intentar con otro correo
                  </Button>

                  <Button
                    className="w-full rounded-xl text-xs font-medium h-10 bg-primary text-primary-foreground hover:bg-primary/90"
                    asChild
                  >
                    <Link href="/login">
                      Volver al inicio de sesión
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* FORMULARIO DE RECUPERACIÓN */
              <form onSubmit={handleSubmit}>
                <CardHeader className="space-y-2 pb-4 pt-6 px-6 sm:px-8 text-center sm:text-left">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
                    <KeyRound className="size-5" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                    Recuperar Contraseña
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                    Ingresa tu correo electrónico registrado y te enviaremos un enlace seguro para restablecer tu acceso.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-6 sm:px-8 pt-2 pb-4">
                  {errorMessage && (
                    <Alert variant="destructive" className="rounded-xl py-2 px-3 text-xs">
                      <AlertCircle className="size-4 mr-1.5" />
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block"
                    >
                      Correo electrónico registrado
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (errorMessage) setErrorMessage(null)
                        }}
                        placeholder="tu@correo.com"
                        className="pl-10 h-11 rounded-xl text-sm border-border/80 focus-visible:ring-primary"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 px-6 sm:px-8 pb-6 pt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Enviando enlace...
                      </span>
                    ) : (
                      "Enviar enlace de recuperación"
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      href="/login"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium"
                    >
                      Volver al inicio de sesión
                    </Link>
                  </div>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </main>

      {/* Pie de seguridad */}
      <footer className="w-full max-w-md mx-auto py-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Acceso seguro • {APP_NAME}</span>
        </div>
      </footer>
    </div>
  )
}

