"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search,
  X,
  UserPlus,
  Calendar,
  CalendarCheck,
  ChevronRight,
  Clock,
  UserX,
  Shield,
  Phone,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import { UserRole, type Patient, AppointmentStatus } from "@psicoagenda/shared"
import {
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  getLatestAttendedAppointment,
} from "@/lib/mock-data"

type FilterChip = "todos" | "recientes" | "proxima-cita" | "inactivos"

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function PantallaBusquedaPaciente() {
  const router = useRouter()
  const { user, isLoading } = useSession()

  // Protección de acceso exclusiva para profesional de psicología
  const effectiveRole =
    user?.role ??
    (user?.email?.toLowerCase().includes("paciente")
      ? UserRole.PATIENT
      : UserRole.PSYCHOLOGIST)

  if (!isLoading && effectiveRole === UserRole.PATIENT) {
    router.replace("/dashboard")
    return null
  }

  const [searchQuery, setSearchQuery] = useState("")
  const [activeChip, setActiveChip] = useState<FilterChip>("todos")

  // Enriquecer pacientes con datos de citas calculados
  const enrichedPatients = useMemo(() => {
    const now = new Date()

    return MOCK_PATIENTS.map((patient) => {
      const latestAttended = getLatestAttendedAppointment(patient.id)

      // Buscar cita programada próxima
      const upcomingApt = MOCK_APPOINTMENTS.filter(
        (apt) =>
          apt.patientId === patient.id &&
          (apt.status === AppointmentStatus.CONFIRMED ||
            apt.status === AppointmentStatus.PENDING) &&
          new Date(apt.startTime).getTime() >= now.getTime() - 12 * 60 * 60 * 1000
      ).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )[0]

      // Inactividad: sin consultas en los últimos 30 días o sin consultas
      const daysSinceLastSession = latestAttended
        ? Math.floor(
            (now.getTime() - new Date(latestAttended.startTime).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 999

      const isInactive = !latestAttended || daysSinceLastSession > 30

      return {
        ...patient,
        latestAttended,
        upcomingApt,
        daysSinceLastSession,
        isInactive,
        effectiveDate: latestAttended
          ? new Date(latestAttended.startTime).getTime()
          : new Date(patient.createdAt).getTime(),
      }
    })
  }, [])

  // Filtrado reactivo de pacientes
  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return enrichedPatients
      .filter((patient) => {
        // Filtro de texto por nombre, correo o ID
        const matchesQuery =
          !query ||
          patient.name.toLowerCase().includes(query) ||
          patient.id.toLowerCase().includes(query) ||
          patient.email.toLowerCase().includes(query) ||
          (patient.phone && patient.phone.toLowerCase().includes(query))

        if (!matchesQuery) return false

        // Filtro por Chips / Tags
        if (activeChip === "recientes") {
          return !!patient.latestAttended
        }
        if (activeChip === "proxima-cita") {
          return !!patient.upcomingApt
        }
        if (activeChip === "inactivos") {
          return patient.isInactive && !patient.upcomingApt
        }

        return true
      })
      .sort((a, b) => {
        if (activeChip === "recientes") {
          return b.effectiveDate - a.effectiveDate
        }
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      })
  }, [enrichedPatients, searchQuery, activeChip])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabecera Principal */}
      <PageHeader
        title="Directorio de Pacientes"
        description="Localiza expedientes clínicos, consulta asistencias recientes y gestiona el seguimiento terapéutico."
        actions={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-xs"
            asChild
          >
            <Link href="/agenda">
              <UserPlus className="mr-1.5 size-3.5" />
              Nuevo Paciente
            </Link>
          </Button>
        }
      />

      {/* SECCIÓN SUPERIOR: BARRA DE BÚSQUEDA ANCHA Y PROMINENTE */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo o ID"
            className="h-12 sm:h-13 pl-12 pr-12 text-sm sm:text-base rounded-2xl bg-card border-border/80 shadow-2xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/70"
            aria-label="Buscar por nombre, correo o ID"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* FILTROS RÁPIDOS (CHIPS / TAGS) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          variant={activeChip === "todos" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveChip("todos")}
          className={
            activeChip === "todos"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
              : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
          }
        >
          Todos ({enrichedPatients.length})
        </Button>

        <Button
          variant={activeChip === "recientes" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveChip("recientes")}
          className={
            activeChip === "recientes"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
              : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
          }
        >
          Recientes
        </Button>

        <Button
          variant={activeChip === "proxima-cita" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveChip("proxima-cita")}
          className={
            activeChip === "proxima-cita"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
              : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
          }
        >
          Con cita próxima
        </Button>

        <Button
          variant={activeChip === "inactivos" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveChip("inactivos")}
          className={
            activeChip === "inactivos"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
              : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
          }
        >
          Inactivos
        </Button>
      </div>

      {/* LISTA DE RESULTADOS (DATA GRID / TARJETAS) */}
      {filteredPatients.length > 0 ? (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => {
            const hasAttended = !!patient.latestAttended
            const hasUpcoming = !!patient.upcomingApt

            return (
              <Card
                key={patient.id}
                className="border-border/70 hover:border-primary/40 transition-all shadow-2xs hover:shadow-xs rounded-2xl flex flex-col justify-between overflow-hidden bg-card"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  {/* Top card: Avatar + Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="size-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(patient.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                          {patient.name}
                        </h3>
                        {patient.isMinor && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground"
                          >
                            Menor
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient.email}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                        ID: {patient.id}
                      </p>
                    </div>
                  </div>

                  {/* Metadatos: Última consulta & Estado */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Última consulta:
                      </span>
                      <span className="font-medium text-foreground">
                        {hasAttended
                          ? formatDate(new Date(patient.latestAttended!.startTime))
                          : "Sin consultas previas"}
                      </span>
                    </div>

                    {hasUpcoming && (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <CalendarCheck className="size-3.5" />
                          Próxima cita:
                        </span>
                        <span className="font-medium text-[11px]">
                          {formatDate(new Date(patient.upcomingApt!.startTime))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botón de acción rápida: Ver Expediente */}
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between h-9 rounded-xl text-xs font-semibold hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                      asChild
                    >
                      <Link href={`/pacientes/${patient.id}`}>
                        <span>Ver Expediente</span>
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ESTADO VACÍO (EMPTY STATE) */
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 sm:p-12 text-center space-y-4">
          <div className="mx-auto size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
            <UserX className="size-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-base text-foreground">
              No se encontraron pacientes
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery
                ? `No hay registros clínicos que coincidan con "${searchQuery}".`
                : "No hay pacientes con el filtro seleccionado en este momento."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs rounded-xl h-9"
              >
                Limpiar búsqueda
              </Button>
            )}
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-9 font-semibold"
              asChild
            >
              <Link href="/agenda">
                <UserPlus className="mr-1.5 size-3.5" />
                + Registrar nuevo paciente
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
