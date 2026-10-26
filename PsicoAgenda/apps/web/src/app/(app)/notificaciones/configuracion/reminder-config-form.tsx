"use client"

import { useEffect, useState } from "react"
import { UserRole } from "@psicoagenda/shared"
import {
  Bell,
  MessageSquare,
  Mail,
  Save,
  Smartphone,
} from "lucide-react"
import { useSession } from "@/lib/use-session"
import { patientService, psychologistService } from "@/services"
import { useToast } from "@/components/toast-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"

interface ReminderConfigState {
  whatsappEnabled: boolean
  emailEnabled: boolean
}

export function ReminderConfigForm() {
  const { user } = useSession()
  const isPatient = user?.role === UserRole.PATIENT
  const [config, setConfig] = useState<ReminderConfigState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)

  // Las preferencias viven en el perfil del usuario (usuarios.notificar_*).
  useEffect(() => {
    if (!user?.role) return
    let cancelled = false
    const load = isPatient ? patientService.getMe() : psychologistService.getMe()
    load
      .then((profile) => {
        if (!cancelled) {
          setConfig({
            whatsappEnabled: profile.notifyWhatsapp ?? false,
            emailEnabled: profile.notifyEmail ?? true,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar tus preferencias.")
      })
    return () => {
      cancelled = true
    }
  }, [user?.role, isPatient])

  const handleSave = async () => {
    if (!config) return
    setIsSaving(true)
    setError(null)

    const payload = { notifyWhatsapp: config.whatsappEnabled, notifyEmail: config.emailEnabled }
    try {
      await (isPatient ? patientService.updateProfile(payload) : psychologistService.updateMe(payload))
      toast({ title: "Preferencias guardadas", status: "success" })
    } catch {
      setError("No se pudieron guardar tus preferencias. Inténtalo de nuevo.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" className="rounded-2xl py-3">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 shadow-2xs rounded-2xl overflow-hidden bg-card">
        <CardHeader className="border-b border-border/40 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Bell className="size-4.5" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
                Canales de aviso
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Define por dónde recibes los recordatorios de tus citas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* Canales de comunicación */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Smartphone className="size-3.5" />
                Canales de comunicación
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start justify-between p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="space-y-1 pr-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Recibir notificaciones por WhatsApp
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Canal principal: mensaje con enlace a la cita directamente al teléfono registrado.
                  </p>
                </div>
                <Switch
                  checked={config?.whatsappEnabled ?? false}
                  disabled={!config}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => prev && { ...prev, whatsappEnabled: checked })
                  }
                  aria-label="Recibir notificaciones por WhatsApp"
                />
              </div>

              <div className="flex items-start justify-between p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="space-y-1 pr-3">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Recibir notificaciones por Correo Electrónico
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Plantilla detallada con los datos de la sesión y archivo de calendario.
                  </p>
                </div>
                <Switch
                  checked={config?.emailEnabled ?? false}
                  disabled={!config}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => prev && { ...prev, emailEnabled: checked })
                  }
                  aria-label="Recibir notificaciones por Correo Electrónico"
                />
              </div>
            </div>
          </div>

        </CardContent>

        <CardFooter className="flex justify-end p-6 border-t border-border/40 bg-muted/15">
          <Button
            onClick={handleSave}
            disabled={isSaving || !config}
            className="w-full sm:w-auto rounded-xl text-sm font-semibold h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {isSaving ? (
              "Guardando..."
            ) : (
              <>
                <Save className="mr-1.5 size-4" />
                Guardar Preferencias de Notificación
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
