"use client"

import Link from "next/link"
import { useState, useMemo, useEffect } from "react"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  User,
  Stethoscope,
  ShieldAlert,
  CheckCircle2,
  Mail,
  Calendar,
  HeartHandshake,
  Loader2,
  FileBadge,
  Eye,
  EyeOff,
} from "lucide-react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

/**
 * Esquema de validación para registro integral de Pacientes y Profesionales.
 */
const registerSchema = z
  .object({
    role: z.enum(["patient", "psychologist"]),
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

    // Campos de Psicólogo/a
    licenseNumber: z.string().optional(),
    specialty: z.string().optional(),
    bio: z.string().optional(),
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

    // Reglas para Paciente
    if (data.role === "patient") {
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
    }

    // Reglas para Psicólogo/a
    if (data.role === "psychologist") {
      if (!data.licenseNumber || data.licenseNumber.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresa una cédula profesional válida",
          path: ["licenseNumber"],
        });
      }
      if (!data.specialty || data.specialty.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona una especialidad o enfoque principal",
          path: ["specialty"],
        });
      }
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;

const SPECIALTY_OPTIONS = [
  "Psicología Clínica",
  "Terapia Cognitivo-Conductual (TCC)",
  "Terapia Sistémica y Familiar",
  "Psicoanálisis y Enfoque Psicodinámico",
  "Terapia Humanista / Gestalt",
  "Neuropsicología Clínica",
  "Psicología Infantil y de la Adolescencia",
  "Terapia de Pareja y Sexología",
  "Otra especialidad",
];

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submittedUser, setSubmittedUser] = useState<{
    email: string;
    role: "patient" | "psychologist";
  } | null>(null);
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
      licenseNumber: "",
      specialty: "",
      bio: "",
      termsAccepted: true,
    },
  });

  const selectedRole = form.watch("role");
  const watchBirthDate = form.watch("birthDate");

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
      };

      if (values.role === "psychologist") {
        metadataPayload.license_number = values.licenseNumber;
        metadataPayload.specialty = values.specialty;
        metadataPayload.bio = values.bio;
      } else {
        metadataPayload.birth_date = values.birthDate;
        metadataPayload.gender = values.gender;
        metadataPayload.address = values.address;
        metadataPayload.is_minor = values.isMinor;
        metadataPayload.emergency_contact = {
          name: values.emergencyContactName,
          phone: values.emergencyContactPhone,
          relationship: values.emergencyContactRelationship,
        };
        if (values.isMinor) {
          metadataPayload.guardian = {
            name: values.guardianName,
            phone: values.guardianPhone,
            relationship: values.guardianRelationship,
          };
        }
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
      setSubmittedUser({
        email: values.email,
        role: values.role,
      });
    } catch {
      setError("Ocurrió un error inesperado al conectar con el servicio de autenticación.");
      setIsPending(false);
    }
  }

  // Estado de confirmación (Email enviado)
  if (submittedUser) {
    return (
      <div className="w-full max-w-md rounded-[28px] bg-card p-8 border border-border shadow-sm text-center flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          ¡Revisa tu correo!
        </h1>
        <div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 font-normal text-xs bg-muted text-foreground">
            {submittedUser.role === "psychologist"
              ? "Cuenta de Profesional"
              : "Cuenta de Paciente"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Enviamos un enlace seguro de activación a:
        </p>
        <p className="font-semibold text-foreground text-sm bg-muted/60 px-4 py-2 rounded-xl">
          {submittedUser.email}
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
    <div className="w-full max-w-xl rounded-[28px] bg-card p-7 sm:p-9 border border-border shadow-sm flex flex-col gap-6">
      {/* Cabecera con isotipo verde y blanco de PsicoAgenda */}
      <div className="text-center flex flex-col items-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold shadow-2xs mb-3">
          Ψ
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Crear cuenta
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Selecciona tu perfil y completa tus datos para acceder a {APP_NAME}
        </p>
      </div>

      <div className="space-y-6">
        {error ? (
          <Alert variant="destructive" className="rounded-xl">
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
            {/* Selector interactivo de perfil */}
            <div className="space-y-2">
              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo de perfil
              </FormLabel>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => form.setValue("role", "patient")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selectedRole === "patient"
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <User className="size-5 mb-1.5" />
                  <span className="text-sm font-semibold">Soy Paciente</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    Agendar citas y consultas
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => form.setValue("role", "psychologist")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selectedRole === "psychologist"
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Stethoscope className="size-5 mb-1.5" />
                  <span className="text-sm font-semibold">Soy Profesional</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    Gestión clínica y agenda
                  </span>
                </button>
              </div>
            </div>

              {/* SECCIÓN 1: Credenciales y datos básicos */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 pb-1 border-b border-border">
                  <Mail className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Datos de acceso
                  </span>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            selectedRole === "psychologist"
                              ? "Lic. Mariana Herrera Morales"
                              : "Carlos Mendoza Ramos"
                          }
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
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Contraseña
                        </FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
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
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Confirmar contraseña
                        </FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="h-10 pr-10 rounded-xl"
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

              {/* SECCIÓN 2 (PACIENTE): Ficha personal, tutor y contacto de emergencia */}
              {selectedRole === "patient" ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2 pb-1 border-b border-border">
                    <Calendar className="size-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Información personal
                    </span>
                  </div>

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
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3.5">
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
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 pb-1 border-b border-border">
                      <HeartHandshake className="size-3.5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Contacto de emergencia (RD-12)
                      </span>
                    </div>

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
              ) : null}

              {/* SECCIÓN 2 (PSICÓLOGO/A): Datos profesionales y especialidad */}
              {selectedRole === "psychologist" ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2 pb-1 border-b border-border">
                    <FileBadge className="size-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Acreditación profesional
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cédula profesional</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej. 12345678"
                              autoComplete="off"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[11px] text-muted-foreground">
                            Expedida por la DGP / SEP
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enfoque / Especialidad</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona tu enfoque" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SPECIALTY_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Semblanza profesional <span className="text-muted-foreground font-normal">(Opcional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe brevemente tus años de experiencia, áreas clínicas de atención o metodología de trabajo..."
                            className="min-h-20 resize-none text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

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

              {/* BOTÓN PRINCIPAL */}
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
            </form>
          </Form>
        </div>

        {/* Footer con enlace a Login */}
        <div className="text-center pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            ¿Ya tengo cuenta?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    );
}
