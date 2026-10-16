"use client"

import { useState, useRef } from "react"
import {
  Camera,
  User,
  Phone,
  Mail,
  CheckCircle2,
  Globe,
  Palette,
  Shield,
  Save,
  RotateCcw,
  AlertCircle,
  FileCheck,
  HeartPulse,
} from "lucide-react"
import { UserRole } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import { useThemePreference } from "@/lib/use-theme"
import { MOCK_PSYCHOLOGIST, getPatientForUser } from "@/lib/mock-data"

const TIMEZONE_OPTIONS = [
  { value: "America/Mexico_City", label: "Ciudad de México (CDMX)" },
  { value: "America/Tijuana", label: "Tijuana" },
  { value: "America/Cancun", label: "Cancún" },
  { value: "America/Hermosillo", label: "Hermosillo" },
] as const

const THEME_OPTIONS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Automático (sistema)" },
] as const

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "U").toUpperCase()
}

export function PantallaPerfilUsuario() {
  const { user } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effectiveRole =
    user?.role ??
    (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const isPatient = effectiveRole === UserRole.PATIENT

  const patientData = isPatient ? getPatientForUser(user) : null

  // 1. Datos personales (Nombre, Teléfono, Correo)
  const [name, setName] = useState<string>(() => {
    if (user?.name) return user.name
    return isPatient ? "María López" : MOCK_PSYCHOLOGIST.name
  })

  const [phone, setPhone] = useState<string>(() => {
    if (isPatient && patientData?.phone) return patientData.phone
    return isPatient ? "+52 55 9876 5432" : (MOCK_PSYCHOLOGIST.phone ?? "+52 55 1234 5678")
  })

  const [email, setEmail] = useState<string>(() => {
    if (user?.email) return user.email
    return isPatient ? "maria.lopez@correo.test" : MOCK_PSYCHOLOGIST.email
  })

  // Campos específicos de rol
  const [licenseNumber, setLicenseNumber] = useState<string>(
    MOCK_PSYCHOLOGIST.licenseNumber ?? "Psic. 12345"
  )
  const [specialty, setSpecialty] = useState<string>(
    MOCK_PSYCHOLOGIST.specialty ?? "Psicología clínica"
  )
  const [emergencyName, setEmergencyName] = useState<string>(
    patientData?.emergencyContact?.name ?? "Carlos López"
  )
  const [emergencyPhone, setEmergencyPhone] = useState<string>(
    patientData?.emergencyContact?.phone ?? "+52 55 1111 2222"
  )

  // 2. Foto de perfil
  const [avatarImage, setAvatarImage] = useState<string | null>(null)

  // 3. Preferencias (Zona horaria y tema de interfaz)
  const [timezone, setTimezone] = useState<string>("America/Mexico_City")
  const { theme, setTheme } = useThemePreference()

  // Estados de retroalimentación
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Manejo de carga de foto de perfil
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarImage(event.target?.result as string)
      setSaveSuccess(false)
    }
    reader.readAsDataURL(file)
  }

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
    setSaveSuccess(false)
  }

  // Guardar Cambios (datos personales y preferencias)
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!name.trim()) {
      setValidationError("El nombre completo no puede quedar vacío.")
      return
    }
    if (!email.trim() || !email.includes("@")) {
      setValidationError("Ingresa un correo electrónico válido.")
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)

    // Simulación de guardado con feedback visual
    setTimeout(() => {
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
      setIsSaving(false)
      setSaveSuccess(true)
      // Ocultar mensaje de éxito tras 6 segundos
      setTimeout(() => {
        setSaveSuccess(false)
      }, 6000)
    }, 500)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabecera de Página */}
      <PageHeader
        title="Perfil de Usuario"
        description="Administra tu información personal, datos de contacto y preferencias de la interfaz."
        actions={
          <Badge
            variant="outline"
            className="text-xs bg-primary/10 text-primary border-primary/20 px-3 py-1 font-medium"
          >
            {isPatient ? "Rol: Paciente" : "Rol: Psicólogo/a"}
          </Badge>
        }
      />

      {/* Alerta de Éxito al Guardar */}
      {saveSuccess && (
        <Alert className="border-primary/40 bg-primary/10 text-foreground rounded-2xl animate-in fade-in-50 duration-200">
          <CheckCircle2 className="size-5 text-primary" />
          <AlertTitle className="font-bold text-foreground">
            ¡Cambios guardados con éxito!
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Tus datos personales y preferencias han sido actualizados.
          </AlertDescription>
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h3 className="font-bold text-base text-foreground truncate">
                    {name || "Usuario"}
                  </h3>
                  <Badge variant="outline" className="text-[10px] w-fit mx-auto sm:mx-0">
                    {isPatient ? "Expediente Activo" : "Especialista Clínico"}
                  </Badge>
                </div>

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
                    setSaveSuccess(false)
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
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setSaveSuccess(false)
                  }}
                  placeholder="+52 55 0000 0000"
                  className="rounded-xl h-11 text-sm bg-background border-border/80 font-mono"
                  required
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
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setSaveSuccess(false)
                  }}
                  placeholder="tu@correo.com"
                  className="rounded-xl h-11 text-sm bg-background border-border/80"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Canal para confirmaciones y enlaces de sesión.
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
                    <Input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+52 55 1111 2222"
                      className="rounded-xl h-11 text-sm bg-background border-border/80 font-mono"
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 2: PREFERENCIAS (Zona horaria y tema de interfaz) */}
        <Card className="border-border/80 bg-card rounded-2xl shadow-2xs overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
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
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Zona Horaria */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-primary" />
                  Zona Horaria
                </label>
                <Select
                  value={timezone}
                  onValueChange={(val) => {
                    setTimezone(val)
                    setSaveSuccess(false)
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Palette className="size-3.5 text-primary" />
                  Diseño de Interfaz
                </label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-full rounded-xl h-11 text-sm bg-background border-border/80">
                    <SelectValue placeholder="Selecciona un tema" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Se aplica de inmediato, sin esperar a &ldquo;Guardar Cambios&rdquo;.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: BOTONES "GUARDAR CAMBIOS" Y "CANCELAR" */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Los cambios se aplicarán inmediatamente a tus próximas citas programadas.
          </p>

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
              disabled={isSaving}
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
