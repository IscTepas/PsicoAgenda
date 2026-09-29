"use client"

import Link from "next/link"
import { useState } from "react"
import { z } from "zod"
import { emailSchema, passwordSchema, APP_NAME } from "@psicoagenda/shared"
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

/**
 * El registro público crea **siempre** una cuenta de paciente, y el formulario ni
 * siquiera ofrece elegir otro rol.
 *
 * No es una decisión de interfaz: el rol efectivo viaja en `app_metadata.role`, que el
 * cliente no puede escribir, y el trigger de alta lo lee con
 * `upper(raw_app_meta_data ->> 'role')`, es decir, de `app_metadata` y no de
 * `user_metadata`. Enviar el rol pedido en `user_metadata` no concedía nada: el perfil
 * nacía con el valor por defecto y la UI prometía un rol que el usuario no tenía.
 *
 * Sacar el selector elimina la promesa falsa en lugar de dejar que parezca funcionar.
 * Los cuentas de psicólogo/a y de administración se crean y se promover por un flujo
 * administrativo; ver la sección "Promover una cuenta" del README.
 */
const registerSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().optional(),
})

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const configured = isSupabaseConfigured()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", phone: "" },
  })

  async function onSubmit(values: RegisterValues) {
    setError(null)
    setIsPending(true)

    // El proveedor crea la identidad, cifra la contraseña y envía el correo de
    // verificación. El perfil en `public.users` lo crea el trigger sobre `auth.users`,
    // que le asigna `PATIENT` porque aquí no se declara ningún rol: un alta pública no
    // puede elegir el suyo.
    const { error: signUpError } = await createClient().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          name: values.name,
          phone: values.phone,
        },
      },
    })

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "Ya existe una cuenta con ese correo"
          : "No se pudo crear la cuenta. Intenta de nuevo.",
      )
      setIsPending(false)
      return
    }

    setIsPending(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <>
        <Link href="/" className="mb-6 text-2xl font-bold text-primary">
          {APP_NAME}
        </Link>

        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Revisa tu correo</CardTitle>
            <CardDescription>
              Te enviamos un enlace de verificación. Inicia sesión cuando lo confirmes.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="link" asChild>
              <Link href="/login">Ir a iniciar sesión</Link>
            </Button>
          </CardFooter>
        </Card>
      </>
    )
  }

  return (
    <>
      <Link href="/" className="mb-6 text-2xl font-bold text-primary">
        {APP_NAME}
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Crear cuenta</CardTitle>
            <CardDescription>
              Crea tu cuenta de paciente. Las cuentas de profesionales las habilita el
              equipo.
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+52 55 1234 5678"
                        autoComplete="tel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isPending || !configured}>
                {isPending ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  )
}
