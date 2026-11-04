"use client"

import { useState, useRef, useEffect } from "react"
import {
  Camera,
  User,
  Phone,
  Mail,
  Globe,
  Palette,
  Shield,
  Save,
  RotateCcw,
  AlertCircle,
  FileCheck,
  HeartPulse,
} from "lucide-react"
import { TIMEZONES, UserRole } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import { useThemePreference } from "@/lib/use-theme"
import { applyTheme, readPreferences, type ThemePreferences } from "@/lib/theme"
import { useUnsavedChanges } from "@/lib/use-unsaved-changes"
import { erroresDePerfil, type CampoPerfil, type ErroresPerfil } from "@/lib/perfil"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TelefonoInput } from "@/components/telefono-input"
import { formatearTelefonoPegado } from "@/lib/telefono"
import { comprimirAvatar } from "@/lib/imagen"
import { ThemePicker } from "@/components/theme-picker"
import { patientService, psychologistService } from "@/services"
import { useToast } from "@/components/toast-provider"

const TIMEZONE_LABELS: Record<(typeof TIMEZONES)[number], string> = {
  "America/Mexico_City": "Ciudad de México (CDMX)",
  "America/Tijuana": "Tijuana",
  "America/Cancun": "Cancún",
  "America/Hermosillo": "Hermosillo",
  "America/Mazatlan": "Tepic / Mazatlán (Nayarit, Sinaloa)",
}

const TIMEZONE_OPTIONS = TIMEZONES.map((value) => ({ value, label: TIMEZONE_LABELS[value] }))

// La BD guarda "UTC" por defecto y no está en la lista: el Select quedaría vacío y la API lo rechaza.
function toKnownTimezone(value: string | null | undefined): string {
  return TIMEZONE_OPTIONS.find((tz) => tz.value === value)?.value ?? "America/Mazatlan" // la del consultorio
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "U").toUpperCase()
}

export function PantallaPerfilUsuario() {
  const { user, updatePhoto } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effectiveRole =
    user?.role ??
    (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const isPatient = effectiveRole === UserRole.PATIENT

  // 1. Datos personales (Nombre, Teléfono, Correo)
  const [name, setName] = useState<string>(user?.name ?? "")
  const [phone, setPhone] = useState<string>("")
  const [email, setEmail] = useState<string>(user?.email ?? "")

  // Campos específicos de rol
  const [licenseNumber, setLicenseNumber] = useState<string>("")
  const [specialty, setSpecialty] = useState<string>("")
  const [emergencyName, setEmergencyName] = useState<string>("")
  const [emergencyPhone, setEmergencyPhone] = useState<string>("")

  // 2. Foto de perfil
  const [avatarImage, setAvatarImage] = useState<string | null>(null)

  // 3. Preferencias (Zona horaria y tema de interfaz)
  const [timezone, setTimezone] = useState<string>("America/Mazatlan")
  const { mode, palette, setMode, setPalette } = useThemePreference()
  // El tema elegido aquí es un borrador: se ve al instante pero solo se guarda con "Guardar cambios".
  const [themeDraft, setThemeDraft] = useState<ThemePreferences | null>(null)
  const shownTheme = themeDraft ?? { mode, palette }
  const previewTheme = (next: ThemePreferences) => {
    setThemeDraft(next)
    applyTheme(next)
  }
  // Al salir sin guardar, la interfaz vuelve al tema guardado.
  useEffect(() => () => applyTheme(readPreferences()), [])

  // Estados de retroalimentación
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [guardianshipEndedAt, setGuardianshipEndedAt] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ErroresPerfil>({})
  // Al corregir un campo se borra su error; los demás se quedan hasta el siguiente intento.
  const limpiarError = (campo: CampoPerfil) =>
    setFieldErrors((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev))
  const errorDe = (campo: CampoPerfil) =>
    fieldErrors[campo] ? (
      <p id={`perfil-error-${campo}`} role="alert" className="text-xs font-medium text-destructive">
        {fieldErrors[campo]}
      </p>
    ) : null
  const propsDeError = (campo: CampoPerfil) =>
    fieldErrors[campo]
      ? { "aria-invalid": true as const, "aria-describedby": `perfil-error-${campo}` }
      : {}

  // Última versión guardada: contra ella se detectan los cambios sin guardar.
  const [saved, setSaved] = useState({
    name,
    phone,
    email,
    timezone,
    licenseNumber,
    specialty,
    emergencyName,
    emergencyPhone,
    avatarImage,
  })

  // El perfil vive en la API: los defaults de arriba son solo el estado de reposo
  // hasta que la carga asíncrona resuelve los valores reales de la cuenta.
  useEffect(() => {
    if (!user?.id) return

    let cancelled = false

    const load = async () => {
      setIsLoadingProfile(true)
      setLoadError(null)
      try {
        if (isPatient) {
          const profile = await patientService.getMe()
          if (cancelled) return
          setName(profile.name)
          setPhone(formatearTelefonoPegado(profile.phone ?? ""))
          setEmail(profile.email)
          setTimezone(toKnownTimezone(profile.timeZone))
          setAvatarImage(profile.photoUrl ?? null)
          updatePhoto(profile.photoUrl)
          setEmergencyName(profile.emergencyContact?.name ?? "")
          setEmergencyPhone(formatearTelefonoPegado(profile.emergencyContact?.phone ?? ""))
          setGuardianshipEndedAt(profile.guardianshipEndedAt ?? null)
          setSaved({
            name: profile.name,
            phone: formatearTelefonoPegado(profile.phone ?? ""),
            email: profile.email,
            timezone: toKnownTimezone(profile.timeZone),
            licenseNumber: "",
            specialty: "",
            emergencyName: profile.emergencyContact?.name ?? "",
            emergencyPhone: formatearTelefonoPegado(profile.emergencyContact?.phone ?? ""),
            avatarImage: profile.photoUrl ?? null,
          })
        } else {
          const profile = await psychologistService.getMe()
          if (cancelled) return
          setName(profile.name)
          setPhone(formatearTelefonoPegado(profile.phone ?? ""))
          setEmail(profile.email)
          setTimezone(toKnownTimezone(profile.timeZone))
          setAvatarImage(profile.photoUrl ?? null)
          updatePhoto(profile.photoUrl)
          setLicenseNumber(profile.licenseNumber ?? "")
          setSpecialty(profile.specialty ?? "")
          setSaved({
            name: profile.name,
            phone: formatearTelefonoPegado(profile.phone ?? ""),
            email: profile.email,
            timezone: toKnownTimezone(profile.timeZone),
            licenseNumber: profile.licenseNumber ?? "",
            specialty: profile.specialty ?? "",
            emergencyName: "",
            emergencyPhone: "",
            avatarImage: profile.photoUrl ?? null,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "No se pudo cargar tu perfil.",
          )
        }
      } finally {
        if (!cancelled) setIsLoadingProfile(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id, isPatient, updatePhoto])

  // Manejo de carga de foto de perfil: se guarda un avatar comprimido (máx. 512 px).
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setValidationError("El archivo seleccionado debe ser una imagen válida (PNG, JPG o WebP).")
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      setValidationError("La imagen excede el límite recomendado de 3 MB.")
      return
    }

    setValidationError(null)

    try {
      // El base64 original podía pesar varios MB y ahora viaja en /auth/me.
      setAvatarImage(await comprimirAvatar(file))
    } catch {
      setValidationError("No se pudo procesar la imagen. Prueba con otra.")
    }
  }

  const DEFAULT_PREFERENCES = { timezone: "America/Mazatlan", mode: "system", palette: "default" } as const

  // Solo preferencias (zona horaria y tema), y como borrador: se aplica con "Guardar cambios".
  const handleResetPreferences = () => {
    setTimezone(DEFAULT_PREFERENCES.timezone)
    previewTheme({ mode: DEFAULT_PREFERENCES.mode, palette: DEFAULT_PREFERENCES.palette })
  }
  const preferencesAreDefault =
    timezone === DEFAULT_PREFERENCES.timezone &&
    shownTheme.mode === DEFAULT_PREFERENCES.mode &&
    shownTheme.palette === DEFAULT_PREFERENCES.palette

  // Apagar el alto contraste vuelve a la paleta guardada (u Original si la guardada era el contraste).
  const handleContrastChange = (on: boolean) =>
    previewTheme({
      mode: shownTheme.mode,
      palette: on ? "contraste" : palette === "contraste" ? "default" : palette,
    })

  const isDirty =
    !isLoadingProfile &&
    (name !== saved.name ||
      phone !== saved.phone ||
      timezone !== saved.timezone ||
      licenseNumber !== saved.licenseNumber ||
      specialty !== saved.specialty ||
      emergencyName !== saved.emergencyName ||
      emergencyPhone !== saved.emergencyPhone ||
      avatarImage !== saved.avatarImage ||
      shownTheme.mode !== mode ||
      shownTheme.palette !== palette)
  const unsaved = useUnsavedChanges(isDirty)

  // Guardar Cambios (datos personales y preferencias)
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    // Todo se envía tal cual: un campo vacío se rechaza aquí (y en la API), no se omite en silencio.
    const comunes = { name, phone, timeZone: timezone, photoUrl: avatarImage ?? "" }
    const payload = isPatient
      ? { ...comunes, emergencyContactName: emergencyName, emergencyContactPhone: emergencyPhone }
      : { ...comunes, licenseNumber, specialty }
    const errores = erroresDePerfil(isPatient, payload)
    setFieldErrors(errores)
    if (Object.keys(errores).length > 0) {
      setValidationError("Revisa los campos marcados en rojo antes de guardar.")
      return
    }

    setIsSaving(true)

    try {
      const guardado = isPatient
        ? await patientService.updateProfile(payload)
        : await psychologistService.updateMe(payload)
      updatePhoto(guardado.photoUrl)

      setSaved({
        name,
        phone,
        email,
        timezone,
        licenseNumber,
        specialty,
        emergencyName,
        emergencyPhone,
        avatarImage,
      })
      // El tema vive en este navegador: se confirma junto con el resto.
      if (themeDraft) {
        setMode(themeDraft.mode)
        setPalette(themeDraft.palette)
        setThemeDraft(null)
      }
      toast({
        title: "Cambios guardados",
        description: "Tus datos personales y preferencias se actualizaron.",
        status: "success",
      })
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "No se pudieron guardar los cambios.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabecera de Página */}
      <PageHeader
        title="Perfil de Usuario"
        description="Administra tu información personal, datos de contacto y preferencias de la interfaz."
      />

      {/* Solo aparece después de la transición por mayoría de edad */}
      {guardianshipEndedAt && (
        <Alert className="rounded-2xl">
          <AlertCircle className="size-5" />
          <AlertTitle className="font-bold">Tu tutoría terminó</AlertTitle>
          <AlertDescription className="text-xs">
            Desde el {guardianshipEndedAt.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}{" "}
            gestionas tu propia agenda. Tu psicóloga te pedirá firmar de nuevo el consentimiento informado.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de Error de Carga del Perfil */}
      {loadError && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-5" />
          <AlertTitle className="font-bold">No se pudo cargar tu perfil</AlertTitle>
          <AlertDescription className="text-xs">{loadError}</AlertDescription>
        </Alert>
      )}

      {/* Alerta de Error de Validación */}
      {validationError && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-5" />
          <AlertTitle className="font-bold">Información incompleta</AlertTitle>
          <AlertDescription className="text-xs">{validationError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* SECCIÓN 1: FOTO DE PERFIL Y DATOS PERSONALES */}
        <Card className="border-border/80 bg-card rounded-2xl shadow-2xs overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <User className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Datos Personales
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Información visible en tu cuenta y en las comunicaciones del sistema
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-6">
            {/* 1.1 FOTO DE PERFIL CON BOTÓN PARA CAMBIARLA */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 rounded-2xl bg-muted/20 border border-border/50">
              {/* Contenedor del Avatar */}
              <div className="relative group shrink-0">
                {avatarImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarImage}
                    alt={`Foto de perfil de ${name}`}
                    className="size-24 rounded-3xl object-cover border-2 border-primary shadow-sm"
                  />
                ) : (
                  <div className="size-24 rounded-3xl bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center border-2 border-primary/20 shadow-2xs">
                    {getInitials(name)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform active:scale-95"
                  title="Cambiar imagen"
                  aria-label="Cambiar imagen"
                >
                  <Camera className="size-4" />
                </button>
              </div>

              {/* Botón para cambiar foto e información complementaria */}
              <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                <h3 className="font-bold text-base text-foreground truncate">
                  {name || "Usuario"}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Agrega una fotografía nítida para identificarte fácilmente durante las citas y en tu expediente.
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    aria-label="Seleccionar archivo de imagen"
                  />

                  {avatarImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAvatarImage(null)}
                      className="text-xs rounded-xl text-muted-foreground hover:text-destructive h-8"
                    >
                      <RotateCcw className="mr-1.5 size-3" />
                      Restablecer
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* 1.2 FORMULARIO DE DATOS PERSONALES (Nombre, Teléfono, Correo) */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Campo Nombre */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="perfil-nombre" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  Nombre Completo
                </label>
                <Input
                  id="perfil-nombre"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    limpiarError("name")
                  }}
                  placeholder="Tu nombre y apellidos"
                  className="rounded-xl h-11 text-sm bg-background border-border/80"
                  required
                  {...propsDeError("name")}
                />
                {errorDe("name")}
              </div>

              {/* Campo Teléfono */}
              <div className="space-y-1.5">
                <label htmlFor="perfil-telefono" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Phone className="size-3.5 text-primary" />
                  Teléfono de Contacto
                </label>
                <TelefonoInput
                  id="perfil-telefono"
                  value={phone}
                  onChange={(valor) => {
                    setPhone(valor)
                    limpiarError("phone")
                  }}
                  placeholder="311-123-4567"
                  className="rounded-xl h-11 text-sm bg-background border-border/80 font-mono"
                  required
                  {...propsDeError("phone")}
                />
                {errorDe("phone")}
                <p className="text-[11px] text-muted-foreground">
                  Se utilizará para los recordatorios por WhatsApp.
                </p>
              </div>

              {/* Campo Correo */}
              <div className="space-y-1.5">
                <label htmlFor="perfil-correo" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5 text-primary" />
                  Correo Electrónico
                </label>
                <Input
                  id="perfil-correo"
                  type="email"
                  value={email}
                  readOnly
                  aria-readonly="true"
                  className="rounded-xl h-11 text-sm bg-muted/40 border-border/80 cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground">
                </p>
              </div>

              {/* Campos adicionales de Psicólogo */}
              {!isPatient && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="perfil-cedula" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <FileCheck className="size-3.5 text-primary" />
                      Cédula Profesional
                    </label>
                    <Input
                      id="perfil-cedula"
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => {
                        setLicenseNumber(e.target.value)
                        limpiarError("licenseNumber")
                      }}
                      placeholder="Psic. 12345"
                      className="rounded-xl h-11 text-sm bg-background border-border/80"
                      required
                      {...propsDeError("licenseNumber")}
                    />
                    {errorDe("licenseNumber")}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="perfil-especialidad" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <HeartPulse className="size-3.5 text-primary" />
                      Especialidad Clínica
                    </label>
                    <Input
                      id="perfil-especialidad"
                      type="text"
                      value={specialty}
                      onChange={(e) => {
                        setSpecialty(e.target.value)
                        limpiarError("specialty")
                      }}
                      placeholder="Psicología clínica / TCC"
                      className="rounded-xl h-11 text-sm bg-background border-border/80"
                      {...propsDeError("specialty")}
                    />
                    {errorDe("specialty")}
                  </div>
                </>
              )}

              {/* Campos adicionales de Paciente (Contacto de Emergencia) */}
              {isPatient && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="perfil-emergencia-nombre" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Shield className="size-3.5 text-primary" />
                      Contacto de Emergencia (Nombre)
                    </label>
                    <Input
                      id="perfil-emergencia-nombre"
                      type="text"
                      value={emergencyName}
                      onChange={(e) => {
                        setEmergencyName(e.target.value)
                        limpiarError("emergencyContactName")
                      }}
                      placeholder="Nombre del familiar"
                      className="rounded-xl h-11 text-sm bg-background border-border/80"
                      required
                      {...propsDeError("emergencyContactName")}
                    />
                    {errorDe("emergencyContactName")}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="perfil-emergencia-telefono" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="size-3.5 text-primary" />
                      Teléfono de Emergencia
                    </label>
                    <TelefonoInput
                      id="perfil-emergencia-telefono"
                      value={emergencyPhone}
                      onChange={(valor) => {
                        setEmergencyPhone(valor)
                        limpiarError("emergencyContactPhone")
                      }}
                      placeholder="311-123-4567"
                      className="rounded-xl h-11 text-sm bg-background border-border/80 font-mono"
                      required
                      {...propsDeError("emergencyContactPhone")}
                    />
                    {errorDe("emergencyContactPhone")}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 2: PREFERENCIAS (Zona horaria y tema de interfaz) */}
        <Card className="border-border/80 bg-card rounded-2xl shadow-2xs overflow-visible">
          <CardHeader className="rounded-t-2xl pb-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Palette className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Preferencias
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ajusta tu zona horaria y el diseño de la interfaz
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Zona Horaria */}
            <div className="space-y-1.5 max-w-sm">
              <label htmlFor="perfil-zona-horaria" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-primary" />
                Zona Horaria
              </label>
              <Select
                value={timezone}
                onValueChange={(val) => {
                  if (!val) return
                  setTimezone(val)
                }}
              >
                <SelectTrigger id="perfil-zona-horaria" className="w-full rounded-xl h-11 text-sm bg-background border-border/80">
                  <SelectValue placeholder="Selecciona tu zona horaria" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Usada para mostrar la hora correcta de tus citas.
              </p>
            </div>

            {/* Diseño de interfaz (tema) */}
            <div className="space-y-2">
              <p id="perfil-diseno" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Palette className="size-3.5 text-primary" />
                Diseño de Interfaz
              </p>
              <ThemePicker
                mode={shownTheme.mode}
                palette={shownTheme.palette}
                onModeChange={(next) => previewTheme({ ...shownTheme, mode: next })}
                onPaletteChange={(next) => previewTheme({ ...shownTheme, palette: next })}
                onContrastChange={handleContrastChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: "RESTABLECER CONFIGURACIÓN" (solo preferencias) Y "GUARDAR CAMBIOS" (todo) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleResetPreferences}
              disabled={isSaving || preferencesAreDefault}
              title="Vuelve la zona horaria y el diseño de interfaz a los predeterminados"
              className="flex-1 sm:flex-none h-11 px-6 rounded-xl border-border/80 font-semibold text-sm"
            >
              <RotateCcw className="mr-1.5 size-4" />
              Restablecer configuración
            </Button>

            <Button
              type="submit"
              size="lg"
              disabled={isSaving || isLoadingProfile}
              className="flex-1 sm:flex-none h-11 px-7 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm shadow-xs transition-all active:scale-[0.98]"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="size-4" />
                  Guardar Cambios
                </span>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Salir con cambios sin guardar */}
      <Dialog open={unsaved.pendingHref !== null} onOpenChange={(open) => !open && unsaved.stay()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tienes cambios sin guardar</DialogTitle>
            <DialogDescription>
              Si sales ahora se pierden los cambios de tu perfil y de tus preferencias. ¿Qué quieres hacer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={unsaved.leave}>
              Salir sin guardar
            </Button>
            <Button type="button" onClick={unsaved.stay}>
              Seguir editando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
