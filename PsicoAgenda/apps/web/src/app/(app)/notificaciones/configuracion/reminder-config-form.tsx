"use client"

import { useState } from "react"
import {
  Bell,
  CheckCircle2,
  MessageSquare,
  Mail,
  Clock,
  Save,
  Smartphone,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ReminderTiming = "12h" | "24h" | "48h"

interface ReminderConfigState {
  whatsappEnabled: boolean
  emailEnabled: boolean
  timing: ReminderTiming
}

const DEFAULT_CONFIG: ReminderConfigState = {
  whatsappEnabled: true,
  emailEnabled: true,
  timing: "24h",
}

export function ReminderConfigForm() {
  const [config, setConfig] = useState<ReminderConfigState>(DEFAULT_CONFIG)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  const handleSave = () => {
    setIsSaving(true)
    setSaveSuccessMessage(null)

    setTimeout(() => {
      setIsSaving(false)
      setSaveSuccessMessage("Tus preferencias de notificaciones se han guardado exitosamente.")

      setTimeout(() => {
        setSaveSuccessMessage(null)
      }, 4000)
    }, 600)
  }

  return (
    <div className="space-y-6">
      {saveSuccessMessage && (
        <Alert className="border-primary/20 bg-primary/10 text-foreground rounded-2xl py-3 animate-in fade-in-50">
          <CheckCircle2 className="size-4 text-primary" />
          <AlertTitle className="font-semibold text-xs sm:text-sm">Preferencias actualizadas</AlertTitle>
          <AlertDescription className="text-xs">{saveSuccessMessage}</AlertDescription>
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
                Canales y anticipación
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Define por dónde y con cuánta anticipación recibes los recordatorios de tus citas.
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
                  checked={config.whatsappEnabled}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, whatsappEnabled: checked }))
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
                  checked={config.emailEnabled}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, emailEnabled: checked }))
                  }
                  aria-label="Recibir notificaciones por Correo Electrónico"
                />
              </div>
            </div>
          </div>

          {/* Anticipación de avisos */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Anticipación de avisos
              </h3>
              <p className="text-xs text-muted-foreground">
                Tiempo de recordatorio previo a la cita.
              </p>
            </div>

            <div className="max-w-md">
              <Select
                value={config.timing}
                onValueChange={(val) =>
                  setConfig((prev) => ({ ...prev, timing: val as ReminderTiming }))
                }
              >
                <SelectTrigger className="h-11 rounded-xl border-border/80 bg-background text-sm">
                  <SelectValue placeholder="Selecciona el tiempo de anticipación" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="24h">24 horas antes</SelectItem>
                  <SelectItem value="12h">12 horas antes</SelectItem>
                  <SelectItem value="48h">48 horas antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end p-6 border-t border-border/40 bg-muted/15">
          <Button
            onClick={handleSave}
            disabled={isSaving}
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
