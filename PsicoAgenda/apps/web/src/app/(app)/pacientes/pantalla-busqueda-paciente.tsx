"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Search,
  X,
  ArrowUpDown,
  Calendar,
  CalendarCheck,
  FileText,
  UserPlus,
  Phone,
  Mail,
  User,
  Shield,
  SlidersHorizontal,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "../components/page-header"
import { type Patient } from "@psicoagenda/shared"
import {
  MOCK_PATIENTS,
  getLatestAttendedAppointment,
  formatAppointmentTime,
} from "@/lib/mock-data"

type SortOption = "recientes" | "alfabetico"
type FilterChip = "todos" | "con-citas" | "sin-citas" | "menores"

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function PantallaBusquedaPaciente() {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState<SortOption>("recientes")
  const [activeFilter, setActiveFilter] = useState<FilterChip>("todos")

  // Enriquecer cada paciente con su última cita atendida calculada
  const enrichedPatients = useMemo(() => {
    return MOCK_PATIENTS.map((patient) => {
      const latestAttended = getLatestAttendedAppointment(patient.id)
      return {
        ...patient,
        latestAttended,
        effectiveDate: latestAttended ? latestAttended.startTime.getTime() : patient.createdAt.getTime(),
      }
    })
  }, [])

  // Filtrado y ordenamiento de pacientes
  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return enrichedPatients
      .filter((patient) => {
        // Filtro por término de búsqueda (nombre o ID)
        const matchesQuery =
          !query ||
          patient.name.toLowerCase().includes(query) ||
          patient.id.toLowerCase().includes(query) ||
          patient.email.toLowerCase().includes(query) ||
          (patient.phone && patient.phone.toLowerCase().includes(query))

        if (!matchesQuery) return false

        // Filtro por chip
        if (activeFilter === "con-citas") return !!patient.latestAttended
        if (activeFilter === "sin-citas") return !patient.latestAttended
        if (activeFilter === "menores") return patient.isMinor

        return true
      })
      .sort((a, b) => {
        if (sortOption === "alfabetico") {
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        }
        // "recientes": más recientes primero según su última cita atendida o registro
        return b.effectiveDate - a.effectiveDate
      })
  }, [enrichedPatients, searchQuery, sortOption, activeFilter])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabecera Principal */}
      <PageHeader
        title="Búsqueda de Pacientes"
        description="Localiza expedientes clínicos, consulta asistencias recientes y gestiona el seguimiento terapéutico."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {MOCK_PATIENTS.length} pacientes registrados
            </span>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-xs"
              asChild
            >
              <Link href="/agenda">
                <Calendar className="mr-1.5 size-3.5" />
                Nueva Cita
              </Link>
            </Button>
          </div>
        }
      />

      {/* SECCIÓN 1: BARRA DE BÚSQUEDA PRINCIPAL GRANDE */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar paciente por nombre o ID (ej. María López, pat-1)..."
            className="h-13 pl-12 pr-12 text-sm sm:text-base rounded-2xl bg-card border-border/80 shadow-2xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/70"
            aria-label="Buscar paciente por nombre o ID"
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

      {/* SECCIÓN 2: FILTROS Y ORDENAMIENTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Chips de filtro rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant={activeFilter === "todos" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("todos")}
            className={
              activeFilter === "todos"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
                : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
            }
          >
            Todos ({enrichedPatients.length})
          </Button>

          <Button
            variant={activeFilter === "con-citas" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("con-citas")}
            className={
              activeFilter === "con-citas"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
                : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
            }
          >
            Con citas atendidas
          </Button>

          <Button
            variant={activeFilter === "sin-citas" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("sin-citas")}
            className={
              activeFilter === "sin-citas"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
                : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
            }
          >
            Sin citas previas
          </Button>

          <Button
            variant={activeFilter === "menores" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("menores")}
            className={
              activeFilter === "menores"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl h-8"
                : "text-xs rounded-xl h-8 border-border/70 text-muted-foreground hover:text-foreground"
            }
          >
            Menores de edad
          </Button>
        </div>

        {/* Filtros de Orden: "Más recientes" o "Alfabético" */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            Ordenar por:
          </span>
          <div className="inline-flex rounded-xl p-0.5 bg-muted/40 border border-border/70">
            <button
              type="button"
              onClick={() => setSortOption("recientes")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                sortOption === "recientes"
                  ? "bg-card text-foreground font-semibold shadow-2xs border border-border/50 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Más recientes
            </button>
            <button
              type="button"
              onClick={() => setSortOption("alfabetico")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                sortOption === "alfabetico"
                  ? "bg-card text-foreground font-semibold shadow-2xs border border-border/50 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Alfabético
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: LISTA DE RESULTADOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-muted-foreground">
            {filteredPatients.length === 1
              ? "1 paciente encontrado"
              : `${filteredPatients.length} pacientes encontrados`}
            {searchQuery && (
              <span>
                {" "}para &ldquo;<strong className="text-foreground">{searchQuery}</strong>&rdquo;
              </span>
            )}
          </p>
        </div>

        {filteredPatients.length > 0 ? (
          <div className="grid gap-3">
            {filteredPatients.map((patient) => {
              const latestAttended = patient.latestAttended

              return (
                <Card
                  key={patient.id}
                  className="border-border/80 bg-card hover:border-primary/40 hover:shadow-sm transition-all rounded-2xl overflow-hidden group"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Información del paciente (Nombre, ID, Badges) */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className="size-11 sm:size-12 rounded-2xl bg-primary/10 text-primary font-bold text-sm sm:text-base flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs group-hover:scale-105 transition-transform">
                          {getInitials(patient.name)}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-foreground text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                              {patient.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] bg-muted/30 border-border/80 px-2 py-0"
                            >
                              {patient.id}
                            </Badge>
                            {patient.isMinor ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                              >
                                Menor de edad
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground border-border/60"
                              >
                                Mayor de edad
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {patient.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="size-3 text-muted-foreground" />
                                {patient.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="size-3 text-muted-foreground" />
                              {patient.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Columna Derecha: Última Cita Atendida + Botón Acceso Directo */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                        {/* Bloque: Última Cita Atendida */}
                        <div className="text-left sm:text-right space-y-1 bg-muted/20 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none border border-border/40 sm:border-none">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                            Última cita atendida
                          </span>
                          {latestAttended ? (
                            <div className="flex items-center sm:justify-end gap-1.5">
                              <CalendarCheck className="size-3.5 text-primary shrink-0" />
                              <span className="text-xs font-medium text-foreground">
                                {formatFullDate(latestAttended.startTime)}
                              </span>
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 px-1.5">
                                Asistió
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex items-center sm:justify-end gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                              <span>Sin citas previas</span>
                            </div>
                          )}
                        </div>

                        {/* Botón de Acceso Directo: "Ver Expediente" */}
                        <Button
                          size="sm"
                          asChild
                          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-[0.98] w-full sm:w-auto"
                        >
                          <Link href={`/pacientes/${patient.id}`}>
                            <FileText className="mr-1.5 size-3.5" />
                            Ver Expediente
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          /* Estado Vacío cuando no hay coincidencias */
          <Card className="border-dashed border-border/80 bg-muted/10 text-center p-8 sm:p-12 rounded-2xl">
            <div className="flex flex-col items-center max-w-sm mx-auto space-y-3">
              <div className="size-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center">
                <Search className="size-6 text-muted-foreground/60" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-foreground text-sm sm:text-base">
                  No se encontraron pacientes
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No hay coincidencias para &ldquo;
                  <strong className="text-foreground">{searchQuery}</strong>
                  &rdquo; con los filtros actuales.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setActiveFilter("todos")
                }}
                className="text-xs rounded-xl mt-2 border-border/80"
              >
                Restablecer búsqueda
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
