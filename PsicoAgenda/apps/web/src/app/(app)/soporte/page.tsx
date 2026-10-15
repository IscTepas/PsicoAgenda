"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  LifeBuoy,
  Phone,
  Mail,
  ShieldCheck,
  HeartHandshake,
  ChevronLeft,
  Clock,
} from "lucide-react"
import { UserRole, type PsychologistProfile } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import { patientService, psychologistService } from "@/services"

function getInitials(name: string): string {
  const parts = name.replace(/^(Dra\.|Dr\.|Psic\.|Lic\.)\s*/i, "").trim().split(" ")
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0]?.[0] ?? "P").toUpperCase()
}

export default function SoportePage() {
  const { user, isLoading } = useSession()
  const [therapist, setTherapist] = useState<PsychologistProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isPatient = user?.role === UserRole.PATIENT

  useEffect(() => {
    if (isLoading || !user) return
    let cancelled = false

    const load = async () => {
      try {
        if (isPatient) {
          const me = await patientService.getMe()
          if (!me.psychologistId) return
          setTherapist(await psychologistService.getById(me.psychologistId))
        } else {
          setTherapist(await psychologistService.getMe())
        }
      } catch {
        if (!cancelled) setLoadError("No se pudieron cargar los datos del profesional.")
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isLoading, user, isPatient])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Centro de Soporte y Contacto"
        description="Estamos aquí para acompañarte y resolver cualquier duda con tus citas o la plataforma."
        actions={
          <Button variant="outline" size="sm" asChild className="rounded-xl border-border/80 text-xs">
            <Link href="/dashboard">
              <ChevronLeft className="mr-1.5 size-3.5" />
              Volver al Inicio
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contacto Directo con tu Terapeuta */}
        <Card className="border-border/80 bg-card shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <HeartHandshake className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Tu Profesional Terapéutico
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Comunicación directa para dudas clínicas y acuerdos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            {loadError ? (
              <p className="text-muted-foreground">{loadError}</p>
            ) : !therapist ? (
              <p className="text-muted-foreground">
                {isLoading ? "Cargando…" : "Sin profesional asignado por ahora."}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {getInitials(therapist.name)}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground text-sm">{therapist.name}</p>
                    {therapist.specialty && (
                      <p className="text-muted-foreground">
                        {therapist.specialty}
                        {therapist.licenseNumber ? ` • ${therapist.licenseNumber}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 p-3.5 rounded-xl bg-muted/20 border border-border/50">
                  {therapist.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Phone className="size-3.5 text-primary" />
                        Teléfono consultorio:
                      </span>
                      <span className="font-mono font-semibold text-foreground">{therapist.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Mail className="size-3.5 text-primary" />
                      Correo de contacto:
                    </span>
                    <span className="font-medium text-foreground">{therapist.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="size-3.5 text-primary" />
                      Horario de atención:
                    </span>
                    <span className="text-foreground">Lun a Vie · 09:00 - 19:00</span>
                  </div>
                </div>
              </>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              💡 Para reprogramar o solicitar una nueva sesión, puedes hacerlo directamente desde la sección de{" "}
              <Link href="/agenda" className="text-primary hover:underline font-semibold">
                Mis Citas
              </Link>.
            </p>
          </CardContent>
        </Card>

        {/* Soporte Técnico y de la Plataforma */}
        <Card className="border-border/80 bg-card shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <LifeBuoy className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Soporte Técnico de PsicoAgenda
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ayuda con tu cuenta, acceso o videollamadas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Si experimentas problemas técnicos para acceder a tu cuenta, visualizar tus citas o conectarte a la sesión virtual, nuestro equipo te apoya de forma inmediata.
            </p>

            <div className="space-y-2 p-3.5 rounded-xl bg-muted/20 border border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Correo de soporte:</span>
                <span className="font-medium text-primary">ayuda@psicoagenda.mx</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tiempo de respuesta:</span>
                <span className="font-medium text-foreground">Menos de 2 horas</span>
              </div>
            </div>

            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-xs"
              onClick={() => {
                window.location.href = "mailto:ayuda@psicoagenda.mx?subject=Soporte%20PsicoAgenda%20-%20Paciente"
              }}
            >
              <Mail className="mr-1.5 size-3.5" />
              Enviar mensaje a soporte
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Línea de Ayuda y Contención en Crisis */}
      <Card className="border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/60 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 text-amber-600 dark:text-amber-400" />
            <span>Líneas Gratuitas de Apoyo Emocional 24 Horas</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Si te encuentras en un momento de crisis urgente o fuera de horarios de consulta, comunícate a estos números oficiales disponibles todos los días:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-xl bg-background/80 border border-amber-200/80 dark:border-amber-900/60">
              <p className="font-bold text-foreground text-sm">Línea de la Vida (México)</p>
              <p className="text-xs text-muted-foreground">Atención psicológica y contención en crisis 24/7</p>
              <p className="font-mono text-base font-bold text-primary mt-1">800 911 2000</p>
            </div>
            <div className="p-3 rounded-xl bg-background/80 border border-amber-200/80 dark:border-amber-900/60">
              <p className="font-bold text-foreground text-sm">Número Nacional de Emergencias</p>
              <p className="text-xs text-muted-foreground">Para cualquier urgencia médica o auxilio inmediato</p>
              <p className="font-mono text-base font-bold text-primary mt-1">911</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
