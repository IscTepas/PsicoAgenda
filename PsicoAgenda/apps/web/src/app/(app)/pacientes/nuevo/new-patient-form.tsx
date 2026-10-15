"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { emailSchema, UserRole } from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
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
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/lib/use-session"
import { MOCK_PATIENTS } from "@/lib/mock-data"
import { PageHeader } from "../../components/page-header"

const phoneSchema = z
  .string()
  .min(10, "Ingresa un teléfono de al menos 10 dígitos")
  .regex(/^[+0-9\s-()]+$/, "Formato de teléfono no válido")

// Mismos datos de admisión que el registro público, sin contraseña: la cuenta
// del paciente la activa el propio paciente.
const newPatientSchema = z
  .object({
    name: z.string().min(2, "Escribe el nombre completo"),
    email: emailSchema,
    phone: phoneSchema,
    birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria"),
    gender: z.string().optional(),
    reason: z.string().optional(),
    emergencyContactName: z.string().min(2, "El nombre del contacto de emergencia es obligatorio"),
    emergencyContactPhone: phoneSchema,
    emergencyContactRelationship: z.string().optional(),
    isMinor: z.boolean(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianRelationship: z.string().optional(),
    guardianConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (MOCK_PATIENTS.some((p) => p.email.toLowerCase() === data.email.trim().toLowerCase())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Ya hay un paciente con este correo" })
    }
    if (!data.isMinor) return
    if (!data.guardianName || data.guardianName.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianName"], message: "El nombre del tutor/a es obligatorio" })
    }
    if (!data.guardianPhone || data.guardianPhone.trim().length < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianPhone"], message: "El teléfono del tutor/a es obligatorio" })
    }
    if (!data.guardianRelationship) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianRelationship"], message: "Indica el parentesco" })
    }
    if (!data.guardianConsent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianConsent"], message: "Se requiere el consentimiento del tutor/a" })
    }
  })

type NewPatientValues = z.infer<typeof newPatientSchema>

const EMPTY_VALUES: NewPatientValues = {
  name: "",
  email: "",
  phone: "",
  birthDate: "",
  gender: "",
  reason: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  isMinor: false,
  guardianName: "",
  guardianPhone: "",
  guardianRelationship: "",
  guardianConsent: false,
}

function ageFrom(birthDate: string): number | null {
  const birth = new Date(birthDate)
  if (!birthDate || Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function Optional() {
  return <span className="font-normal text-muted-foreground">(opcional)</span>
}

export function NewPatientForm({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const router = useRouter()
  const { user, isLoading } = useSession()
  const [isSaving, setIsSaving] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)

  const isPatient =
    (user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)) ===
    UserRole.PATIENT

  // Solo el/la psicólogo/a registra pacientes desde aquí.
  useEffect(() => {
    if (!isLoading && isPatient) router.replace("/dashboard")
  }, [isLoading, isPatient, router])

  const form = useForm<NewPatientValues>({
    resolver: zodResolver(newPatientSchema),
    defaultValues: EMPTY_VALUES,
  })

  const birthDate = useWatch({ control: form.control, name: "birthDate" })
  const isMinor = useMemo(() => {
    const age = ageFrom(birthDate)
    return age !== null && age >= 0 && age < 18
  }, [birthDate])

  useEffect(() => {
    form.setValue("isMinor", isMinor)
  }, [isMinor, form])

  async function onSubmit(values: NewPatientValues) {
    setIsSaving(true)
    // Aún no hay API de pacientes: el guardado se simula igual que en "Nueva cita".
    await new Promise((resolve) => setTimeout(resolve, 600))
    setIsSaving(false)
    setSavedName(values.name.trim())
  }

  function registerAnother() {
    form.reset(EMPTY_VALUES)
    setSavedName(null)
  }

  if (isPatient) return null

  const backLink = (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <ArrowLeft className="size-4" />
      {backLabel}
    </Link>
  )

  if (savedName) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        {backLink}
        <div
          role="status"
          className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center animate-in fade-in duration-300 sm:p-10"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-in zoom-in-75 duration-300">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Paciente registrado</h1>
            <p className="text-sm text-muted-foreground">
              Se creó el expediente de <span className="font-medium text-foreground">{savedName}</span>.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/agenda/nueva">Agendar su primera cita</Link>
            </Button>
            <Button variant="outline" onClick={registerAnother}>
              Registrar otro paciente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {backLink}

      <PageHeader
        title="Nuevo paciente"
        description="Registra los datos de admisión. Lo marcado como opcional se puede completar después."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="divide-y divide-border rounded-2xl border border-border bg-card"
          noValidate
        >
          {/* Datos del paciente */}
          <section className="space-y-4 p-6 sm:p-8">
            <h2 className="text-base font-semibold tracking-tight">Datos del paciente</h2>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre y apellidos" autoComplete="off" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="correo@ejemplo.com" autoComplete="off" {...field} />
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
                      <Input type="tel" placeholder="+52 55 1234 5678" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                    <FormLabel>
                      Género <Optional />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Femenino">Femenino</SelectItem>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="No binario">No binario</SelectItem>
                        <SelectItem value="Prefiero no decir">Prefiero no decir</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Motivo de consulta <Optional />
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Lo que trae al paciente a terapia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Tutor legal: aparece solo si el paciente es menor de edad */}
          {isMinor ? (
            <section className="space-y-4 bg-primary/[0.03] p-6 animate-in fade-in slide-in-from-top-1 duration-200 sm:p-8">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Tutor legal</h2>
                <p className="text-sm text-muted-foreground">
                  El paciente es menor de edad: registra a su madre, padre o tutor/a y su consentimiento.
                </p>
              </div>

              <FormField
                control={form.control}
                name="guardianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo del tutor/a</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre y apellidos" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="guardianRelationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parentesco</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona" />
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
                      <FormLabel>Teléfono del tutor/a</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+52 55 1234 5678" autoComplete="off" {...field} />
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
                  <FormItem className="flex flex-row items-start gap-2.5 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer font-normal">
                        El tutor/a autorizó el registro y la atención psicológica del menor.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </section>
          ) : null}

          {/* Contacto de emergencia */}
          <section className="space-y-4 p-6 sm:p-8">
            <h2 className="text-base font-semibold tracking-tight">Contacto de emergencia</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del contacto" autoComplete="off" {...field} />
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
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+52 55 9876 5432" autoComplete="off" {...field} />
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
                    Relación <Optional />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Pareja, hermano/a, amistad…" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Acciones */}
          <div className="flex flex-col-reverse gap-2 p-6 sm:flex-row sm:justify-end sm:p-8">
            <Button asChild variant="ghost">
              <Link href={backHref}>Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar paciente"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
