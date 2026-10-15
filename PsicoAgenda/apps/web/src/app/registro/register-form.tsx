"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useMemo, useEffect } from "react"
import { z } from "zod"
import { emailSchema, passwordSchema, APP_NAME } from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

/**
 * Esquema de validación para registro integral de Pacientes y Profesionales.
 */
const registerSchema = z
  .object({
    role: z.literal("patient"),
    name: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres"),
    email: emailSchema,
    phone: z
      .string()
      .min(10, "El teléfono debe contener al menos 10 dígitos")
      .regex(/^[+0-9\s-()]+$/, "Formato de teléfono no válido"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar el aviso de privacidad" }),
    }),

    // Campos de Paciente
    birthDate: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelationship: z.string().optional(),
    isMinor: z.boolean().optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianRelationship: z.string().optional(),
    guardianConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Coincidencia de contraseña
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
      });
    }

    if (!data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de nacimiento es obligatoria",
        path: ["birthDate"],
      });
    }

    if (!data.emergencyContactName || data.emergencyContactName.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre del contacto de emergencia es obligatorio",
        path: ["emergencyContactName"],
      });
    }

    if (!data.emergencyContactPhone || data.emergencyContactPhone.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa un teléfono de emergencia válido (mínimo 10 dígitos)",
        path: ["emergencyContactPhone"],
      });
    }

    // Requisitos si es menor de edad
    if (data.isMinor) {
      if (!data.guardianName || data.guardianName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El nombre del tutor/a legal es obligatorio para menores de edad",
          path: ["guardianName"],
        });
      }
      if (!data.guardianPhone || data.guardianPhone.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El teléfono del tutor/a legal es obligatorio",
          path: ["guardianPhone"],
        });
      }
      if (!data.guardianRelationship || data.guardianRelationship.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Especifica el parentesco del tutor legal",
          path: ["guardianRelationship"],
        });
      }
      if (!data.guardianConsent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Se requiere la autorización expresa del tutor legal",
          path: ["guardianConsent"],
        });
      }
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "patient",
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      birthDate: "",
      gender: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      isMinor: false,
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
      guardianConsent: false,
      termsAccepted: true,
    },
  });

  const watchBirthDate = useWatch({ control: form.control, name: "birthDate" });

  // Detección automática y reactiva de minoría de edad (< 18 años)
  const isMinor = useMemo(() => {
    if (!watchBirthDate) return false;
    const birth = new Date(watchBirthDate);
    if (isNaN(birth.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age < 18;
  }, [watchBirthDate]);

  useEffect(() => {
    form.setValue("isMinor", isMinor);
  }, [isMinor, form]);

  async function onSubmit(values: RegisterValues) {
    setError(null);
    setIsPending(true);

    try {
      const client = createClient();
      const metadataPayload: Record<string, unknown> = {
        name: values.name,
        phone: values.phone,
        role: values.role,
        birth_date: values.birthDate,
        gender: values.gender,
        address: values.address,
        is_minor: values.isMinor,
        emergency_contact: {
          name: values.emergencyContactName,
          phone: values.emergencyContactPhone,
          relationship: values.emergencyContactRelationship,
        },
      };

      if (values.isMinor) {
        metadataPayload.guardian = {
          name: values.guardianName,
          phone: values.guardianPhone,
          relationship: values.guardianRelationship,
        };
      }

      const { error: signUpError } = await client.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: metadataPayload,
        },
      });

      if (signUpError) {
        if (signUpError.message === "User already registered") {
          setError("Ya existe una cuenta registrada con este correo electrónico.");
        } else {
          setError(signUpError.message || "No se pudo crear la cuenta. Inténtalo nuevamente.");
        }
        setIsPending(false);
        return;
      }

      setIsPending(false);
      setSubmittedEmail(values.email);
    } catch {
      setError("Ocurrió un error inesperado al conectar con el servicio de autenticación.");
      setIsPending(false);
    }
  }

  // Estado de confirmación (Email enviado)
  if (submittedEmail) {
    return (
      <div className="w-full max-w-md rounded-4xl bg-card p-8 border border-border shadow-sm text-center flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          ¡Revisa tu correo!
        </h1>
        <div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 font-normal text-xs bg-muted text-foreground">
            Cuenta de Paciente
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Enviamos un enlace seguro de activación a:
        </p>
        <p className="font-semibold text-foreground text-sm bg-muted/60 px-4 py-2 rounded-xl">
          {submittedEmail}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
          Por motivos de seguridad y confidencialidad clínica, confirma tu cuenta haciendo clic en el enlace recibido antes de iniciar sesión.
        </p>
        <div className="w-full flex flex-col gap-2 pt-3">
          <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl">
            <Link href="/login">Ir a iniciar sesión</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="rounded-xl text-muted-foreground hover:text-foreground">
            <Link href="/">Regresar al inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl rounded-4xl bg-card p-7 sm:p-9 border border-border shadow-sm flex flex-col gap-6">
      {/* Cabecera con el logo de PsicoAgenda */}
      <div className="text-center flex flex-col items-center">
        <Image
          src="/images/psicoagenda-logo.png"
          alt={APP_NAME}
          width={167}
          height={116}
          className="mb-2 h-[116px] w-[167px] object-contain"
          priority
        />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Crear una nueva cuenta
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Completa tus datos para acceder a {APP_NAME}
        </p>
      </div>

      <div className="space-y-6">
        {error ? (
          <Alert
            variant="destructive"
            className="rounded-xl animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!configured ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>
              Faltan variables de entorno en el cliente. Revisa tu archivo{" "}
              <code>.env</code>.
            </AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* El alta pública solo crea cuentas de paciente; el rol de
                psicólogo/a se asigna desde el panel administrativo. */}

              {/* SECCIÓN 1: Credenciales y datos básicos */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Datos de acceso
                </h2>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Carlos Mendoza Ramos"
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-4">
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono móvil</FormLabel>
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
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pr-10"
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
                        <FormDescription className="text-[11px] leading-tight text-muted-foreground">
                          Mín. 8 caracteres, mayúscula, minúscula y número
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pr-10"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* SECCIÓN 2: Ficha personal, tutor y contacto de emergencia */}
              <div className="space-y-4 pt-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Información personal
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de nacimiento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Género</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona una opción" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Femenino">Femenino</SelectItem>
                              <SelectItem value="Masculino">Masculino</SelectItem>
                              <SelectItem value="No binario">No binario</SelectItem>
                              <SelectItem value="Prefiero no decir">
                                Prefiero no decir
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Dirección <span className="text-muted-foreground font-normal">(Opcional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ciudad, municipio o dirección"
                            autoComplete="street-address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* BLOQUE REACTIVO: Tutor legal si es menor de edad */}
                  {isMinor ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-primary">
                            Paciente menor de edad (Consentimiento y Tutor Legal)
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            Conforme a la normativa clínica y el RD-11, el registro de
                            menores de 18 años requiere los datos de contacto y
                            consentimiento de la madre, padre o tutor/a legal.
                          </p>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="guardianName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Nombre completo del tutor/a</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre de madre, padre o tutor" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid sm:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="guardianRelationship"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Parentesco / Representación</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Parentesco" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Madre">Madre</SelectItem>
                                  <SelectItem value="Padre">Padre</SelectItem>
                                  <SelectItem value="Tutor legal">Tutor/a legal</SelectItem>
                                  <SelectItem value="Familiar responsable">Familiar responsable</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="guardianPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Teléfono del tutor/a</FormLabel>
                              <FormControl>
                                <Input type="tel" placeholder="+52 55 1234 5678" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="guardianConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-2 space-y-0 pt-1">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-0.5 leading-none">
                              <FormLabel className="text-xs font-normal text-foreground cursor-pointer">
                                Como tutor/a legal, autorizo el registro y la atención psicológica del menor.
                              </FormLabel>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {/* BLOQUE: Contacto de emergencia (RD-12) */}
                  <div className="space-y-3 pt-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Contacto de emergencia
                    </h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del contacto</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre de contacto" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono de emergencia</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+52 55 9876 5432" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="emergencyContactRelationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Parentesco o relación <span className="text-muted-foreground font-normal">(Opcional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. Pareja, Hermano/a, Amistad" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              {/* AVISO DE PRIVACIDAD Y TÉRMINOS */}
              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0 pt-2 border-t border-border">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5 leading-none">
                      <FormLabel className="text-xs font-normal text-muted-foreground cursor-pointer">
                        Acepto el{" "}
                        <span className="text-primary font-medium underline-offset-4 hover:underline">
                          Aviso de Privacidad
                        </span>{" "}
                        y autorizo el tratamiento confidencial de mis datos conforme a la
                        LFPDPPP y el secreto profesional.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* BOTONES: Registrarse (principal) y Cancelar / Volver al login (secundario) */}
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all"
                  disabled={isPending || !configured}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Procesando registro...
                    </>
                  ) : (
                    "Registrarse"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  asChild
                  className="w-full h-11 rounded-xl text-sm font-semibold border-border hover:bg-muted text-foreground"
                >
                  <Link href="/login">Cancelar / Volver al login</Link>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    );
}
