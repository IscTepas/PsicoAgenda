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
import { TelefonoInput } from "@/components/telefono-input"
import { contarDigitosTelefono, formatearTelefonoPegado } from "@/lib/telefono"
import { comprimirAvatar } from "@/lib/imagen"
import { ThemePicker } from "@/components/theme-picker"
import { patientService, psychologistService } from "@/services"
import { useToast } from "@/components/toast-provider"

const TIMEZONE_LABELS: Record<(typeof TIMEZONES)[number], string> = {
  "America/Mexico_City": "Ciudad de México (CDMX)",
  "America/Tijuana": "Tijuana",
  "America/Cancun": "Cancún",
  "America/Hermosillo": "Hermosillo",
}

const TIMEZONE_OPTIONS = TIMEZONES.map((value) => ({ value, label: TIMEZONE_LABELS[value] }))

// La BD guarda "UTC" por defecto y no está en la lista: el Select quedaría vacío y la API lo rechaza.
function toKnownTimezone(value: string | null | undefined): string {
  return TIMEZONE_OPTIONS.find((tz) => tz.value === value)?.value ?? "America/Mexico_City"
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
  const [timezone, setTimezone] = useState<string>("America/Mexico_City")
  const { mode, palette, setMode, setPalette, reset } = useThemePreference()

  // Estados de retroalimentación
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const [validationError, setValidationError] = useState<string | null>(null)

  // Última versión guardada: permite que "Cancelar" descarte ediciones sin confirmar.
  const savedSnapshotRef = useRef({
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
          savedSnapshotRef.current = {
            name: profile.name,
            phone: formatearTelefonoPegado(profile.phone ?? ""),
            email: profile.email,
            timezone: toKnownTimezone(profile.timeZone),
            licenseNumber: "",
            specialty: "",
            emergencyName: profile.emergencyContact?.name ?? "",
            emergencyPhone: formatearTelefonoPegado(profile.emergencyContact?.phone ?? ""),
            avatarImage: profile.photoUrl ?? null,
          }
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
          savedSnapshotRef.current = {
            name: profile.name,
            phone: formatearTelefonoPegado(profile.phone ?? ""),
            email: profile.email,
            timezone: toKnownTimezone(profile.timeZone),
            licenseNumber: profile.licenseNumber ?? "",
            specialty: profile.specialty ?? "",
            emergencyName: "",
            emergencyPhone: "",
            avatarImage: profile.photoUrl ?? null,
          }
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

  const handleCancel = () => {
    const saved = savedSnapshotRef.current
    setName(saved.name)
    setPhone(saved.phone)
    setEmail(saved.email)
    setTimezone(saved.timezone)
    setLicenseNumber(saved.licenseNumber)
    setSpecialty(saved.specialty)
    setEmergencyName(saved.emergencyName)
    setEmergencyPhone(saved.emergencyPhone)
    setAvatarImage(saved.avatarImage)
    setValidationError(null)
  }

  // Guardar Cambios (datos personales y preferencias)
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const nombre = name.trim()
    if (nombre.length < 2) {
      setValidationError("El nombre completo debe tener al menos 2 caracteres.")
      return
    }
    if (nombre.length > 120) {
      setValidationError("El nombre completo es demasiado largo (máximo 120 caracteres).")
      return
    }
    if (phone && contarDigitosTelefono(phone) !== 10) {
      setValidationError("El teléfono debe tener 10 dígitos.")
      return
    }

    if (isPatient) {
      const contactoNombre = emergencyName.trim()
      const contactoTelefono = emergencyPhone.trim()
      if (Boolean(contactoNombre) !== Boolean(contactoTelefono)) {
        setValidationError("El contacto de emergencia necesita nombre y teléfono.")
        return
      }
      if (contactoNombre && contarDigitosTelefono(contactoTelefono) !== 10) {
        setValidationError("El teléfono de emergencia debe tener 10 dígitos.")
        return
      }
    } else {
      const cedula = licenseNumber.trim()
      if (cedula && !/^[A-Za-z0-9ÁÉÍÓÚÜáéíóúüÑñ.\s-]{4,30}$/.test(cedula)) {
        setValidationError("La cédula debe tener entre 4 y 30 caracteres válidos.")
        return
      }
      if (specialty.trim().length > 120) {
        setValidationError("La especialidad es demasiado larga (máximo 120 caracteres).")
        return
      }
    }

    setIsSaving(true)

    try {
      if (isPatient) {
        const guardado = await patientService.updateProfile({
          name,
          phone: phone || undefined,
          timeZone: timezone,
          photoUrl: avatarImage ?? undefined,
          emergencyContactName: emergencyName.trim() || undefined,
          emergencyContactPhone: emergencyPhone || undefined,
        })
        updatePhoto(guardado.photoUrl)
      } else {
        const guardado = await psychologistService.updateMe({
          name,
          phone: phone || undefined,
          timeZone: timezone,
          photoUrl: avatarImage ?? undefined,
          licenseNumber: licenseNumber.trim() || undefined,
          specialty: specialty.trim() || undefined,
        })
        updatePhoto(guardado.photoUrl)
      }

      savedSnapshotRef.current = {
        name,
        phone,
        email,
        timezone,
        licenseNumber,
        specialty,
        emergencyName,
        emergencyPhone,
        avatarImage,
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs rounded-xl border-border/80 h-8"
                  >
                    <Camera className="mr-1.5 size-3.5 text-primary" />
                    Cambiar imagen
                  </Button>

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
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  Nombre Completo
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                  }}
                  placeholder="Tu nombre y apellidos"
                  className="rounded-xl h-11 text-sm bg-background border-border/80"
                  required
                />
              </div>

              {/* Campo Teléfono */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Phone className="size-3.5 text-primary" />
                  Teléfono de Contacto
                </label>
                <TelefonoInput
                  value={phone}
                  onChange={(valor) => {
                    setPhone(valor)
                  }}
                  placeholder="311-123-4567"
                  className="rounded-xl h-11 text-sm bg-background border-border/80 font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se utilizará para los recordatorios por WhatsApp.
                </p>
              </div>

              {/* Campo Correo */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5 text-primary" />
                  Correo Electrónico
                </label>
                <Input
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
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <FileCheck className="size-3.5 text-primary" />
                      Cédula Profesional
                    </label>
                    <Input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="Psic. 12345"
                      className="rounded-xl h-11 text-sm bg-background border-border/80"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <HeartPulse className="size-3.5 text-primary" />
                      Especialidad Clínica
                    </label>
                    <Input
                      type="text"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="Psicología clínica / TCC"
                      className="rounded-xl h-11 text-sm bg-background border-border/80"
                    />
                  </div>
                </>
              )}

              {/* Campos adicionales de Paciente (Contacto de Emergencia) */}
              {isPatient && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Shield className="size-3.5 text-primary" />
                      Contacto de Emergencia (Nombre)
                    </label>
                    <Input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Nombre del familiar"
                      className="rounded-xl h-11 text-sm bg-background border-border/80"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="size-3.5 text-primary" />
                      Teléfono de Emergencia
                    </label>
                    <TelefonoInput
                      value={emergencyPhone}
                      onChange={(valor) => {
                        setEmergencyPhone(valor)
                      }}
                      placeholder="311-123-4567"
                      className="rounded-xl h-11 text-sm bg-background border-border/80 font-mono"
                    />
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
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
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
                <SelectTrigger className="w-full rounded-xl h-11 text-sm bg-background border-border/80">
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
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Palette className="size-3.5 text-primary" />
                Diseño de Interfaz
              </label>
              <ThemePicker
                mode={mode}
                palette={palette}
                onModeChange={setMode}
                onPaletteChange={setPalette}
                onReset={reset}
              />
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: BOTONES "GUARDAR CAMBIOS" Y "CANCELAR" */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 sm:flex-none h-11 px-6 rounded-xl border-border/80 font-semibold text-sm"
            >
              Cancelar
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
    </div>
  )
}
