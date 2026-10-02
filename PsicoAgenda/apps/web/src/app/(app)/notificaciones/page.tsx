"use client"

import { useState } from "react"
import {
  Bell,
  Settings2,
  CheckCircle2,
  MessageSquare,
  Mail,
  Clock,
  CalendarCheck,
  RotateCcw,
  Save,
  Smartphone,
} from "lucide-react"
import { NotificationStatus } from "@psicoagenda/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "../components/page-header"
import { MOCK_NOTIFICATIONS, formatShortDate } from "@/lib/mock-data"

type ReminderTiming = "24h" | "48h" | "same-day"

interface ReminderConfigState {
  whatsappEnabled: boolean
  emailEnabled: boolean
  timing: ReminderTiming
  notifyNewAppointments: boolean
  notifyChangesOrCancellations: boolean
  notifyPaymentConfirmation: boolean
}

const DEFAULT_CONFIG: ReminderConfigState = {
  whatsappEnabled: true,
  emailEnabled: true,
  timing: "24h",
  notifyNewAppointments: true,
  notifyChangesOrCancellations: true,
  notifyPaymentConfirmation: true,
}

function statusLabel(status: NotificationStatus) {
  switch (status) {
    case NotificationStatus.PENDING:
      return { label: "Pendiente", variant: "secondary" as const }
    case NotificationStatus.SENT:
      return { label: "Enviada", variant: "default" as const }
    case NotificationStatus.FAILED:
      return { label: "Fallida", variant: "destructive" as const }
    case NotificationStatus.CANCELLED:
      return { label: "Cancelada", variant: "outline" as const }
  }
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"config" | "avisos">("config")

  // Estado de configuración de recordatorios
  const [config, setConfig] = useState<ReminderConfigState>(DEFAULT_CONFIG)
  const [savedConfig, setSavedConfig] = useState<ReminderConfigState>(DEFAULT_CONFIG)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  // Guardar preferencias
  const handleSave = () => {
    setIsSaving(true)
    setSaveSuccessMessage(null)

    setTimeout(() => {
      setSavedConfig(config)
      setIsSaving(false)
      setSaveSuccessMessage("Tus preferencias de recordatorios y avisos se han guardado exitosamente.")

      setTimeout(() => {
        setSaveSuccessMessage(null)
      }, 4000)
    }, 600)
  }

  // Descartar cambios
  const handleDiscard = () => {
    setConfig(savedConfig)
    setSaveSuccessMessage(null)
  }

  const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(savedConfig)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabecera Principal */}
      <PageHeader
        title="Notificaciones y Recordatorios"
        description="Gestiona las preferencias de recordatorios automáticos para pacientes y el historial de avisos del consultorio."
      />

      {/* Pestañas de Navegación */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "config" | "avisos")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md h-11 p-1 bg-muted/60 rounded-xl">
          <TabsTrigger
            value="config"
            className="flex items-center gap-2 rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Settings2 className="size-3.5" />
            Configuración
          </TabsTrigger>
          <TabsTrigger
            value="avisos"
            className="flex items-center gap-2 rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Bell className="size-3.5" />
            Bandeja de Avisos
          </TabsTrigger>
        </TabsList>

        {/* PANTALLA 3: CONFIGURACIÓN DE NOTIFICACIONES Y RECORDATORIOS */}
        <TabsContent value="config" className="mt-6 space-y-6">
          {saveSuccessMessage && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-2xl py-3 animate-in fade-in-50">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="font-semibold text-xs sm:text-sm">Configuración actualizada</AlertTitle>
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
                    Configuración de Notificaciones y Recordatorios
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Define los canales automáticos, tiempos de anticipación y tipos de avisos para tus citas.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-8">
              {/* SECCIÓN 1: CANALES DE ENVÍO */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="size-3.5" />
                    Sección 1: Canales de envío
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecciona a través de cuáles medios automáticos se enviarán los recordatorios al paciente.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Toggle WhatsApp */}
                  <div className="flex items-start justify-between p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-semibold text-foreground">
                          Recordatorios por WhatsApp
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Envío automatizado de mensajes con enlace a la cita directamente al teléfono del paciente.
                      </p>
                    </div>
                    <Switch
                      checked={config.whatsappEnabled}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, whatsappEnabled: checked }))
                      }
                      aria-label="Activar recordatorios por WhatsApp"
                    />
                  </div>

                  {/* Toggle Correo Electrónico */}
                  <div className="flex items-start justify-between p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          Recordatorios por Correo Electrónico
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Plantilla detallada con detalles de la sesión, botón de confirmación y archivo de calendario.
                      </p>
                    </div>
                    <Switch
                      checked={config.emailEnabled}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, emailEnabled: checked }))
                      }
                      aria-label="Activar recordatorios por Correo Electrónico"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: ANTICIPACIÓN */}
              <div className="space-y-4 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    Sección 2: Anticipación
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tiempo de antelación con el que se despachará el recordatorio previo al horario agendado.
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
                      <SelectItem value="48h">48 horas antes</SelectItem>
                      <SelectItem value="same-day">Mismo día (2 horas antes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SECCIÓN 3: TIPOS DE AVISO */}
              <div className="space-y-4 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CalendarCheck className="size-3.5" />
                    Sección 3: Tipos de aviso
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Habilita las alertas automáticas que se emitirán ante cambios en el ciclo de vida de la consulta.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Checkbox 1: Nuevas citas agendadas */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors">
                    <Checkbox
                      checked={config.notifyNewAppointments}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          notifyNewAppointments: !!checked,
                        }))
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-foreground block">
                        Nuevas citas agendadas
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        Notifica al paciente inmediatamente cuando se reserva una nueva sesión en la agenda.
                      </span>
                    </div>
                  </label>

                  {/* Checkbox 2: Cambios o cancelaciones */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors">
                    <Checkbox
                      checked={config.notifyChangesOrCancellations}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          notifyChangesOrCancellations: !!checked,
                        }))
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-foreground block">
                        Cambios o cancelaciones
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        Avisa si la hora o fecha es reasignada, o si la consulta es cancelada con antelación.
                      </span>
                    </div>
                  </label>

                  {/* Checkbox 3: Confirmación de pago/honorario */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors">
                    <Checkbox
                      checked={config.notifyPaymentConfirmation}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          notifyPaymentConfirmation: !!checked,
                        }))
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-foreground block">
                        Confirmación de pago/honorario
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        Emite un comprobante o confirmación de recepción de honorarios tras registrar el pago.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </CardContent>

            {/* BOTONES (FOOTER) */}
            <CardFooter className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 p-6 border-t border-border/40 bg-muted/15">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges || isSaving}
                className="w-full sm:w-auto rounded-xl text-xs font-medium h-10 border-border/80"
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Descartar cambios
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-auto rounded-xl text-xs font-semibold h-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                {isSaving ? (
                  "Guardando preferencias..."
                ) : (
                  <>
                    <Save className="mr-1.5 size-3.5" />
                    Guardar preferencias
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* BANDEJA DE AVISOS (HISTORIAL) */}
        <TabsContent value="avisos" className="mt-6 space-y-4">
          <Alert className="rounded-2xl border-border/80">
            <Bell className="size-4" />
            <AlertTitle className="text-xs font-semibold">Registro de Notificaciones</AlertTitle>
            <AlertDescription className="text-xs">
              Historial de avisos generados y despachados según las reglas de configuración vigentes.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {MOCK_NOTIFICATIONS.map((notification) => {
              const status = statusLabel(notification.status)
              return (
                <Card key={notification.id} className="rounded-2xl border-border/70 shadow-2xs">
                  <CardHeader className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {notification.subject}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {notification.channel === "whatsapp" ? "WhatsApp" : "Correo electrónico"} ·{" "}
                          {notification.scheduledFor
                            ? formatShortDate(notification.scheduledFor)
                            : "Sin programar"}
                        </CardDescription>
                      </div>
                      <Badge variant={status.variant} className="text-[11px] rounded-full px-2.5">
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 pt-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {notification.message}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
