"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, X, ChevronRight, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, type TableColumn } from "@/components/motion/table"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import {
  UserRole,
  AppointmentStatus,
  AttendanceStatus,
} from "@psicoagenda/shared"
import { appointmentService, patientService } from "@/services"


function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
}

function ageFrom(birth: Date, today: Date): number {
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
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

  const [searchQuery, setSearchQuery] = useState("")

  const { data: patientsRaw = [], isLoading: loadingP, error: errP } = useQuery({
    queryKey: ["patients", "directory", 100],
    queryFn: () => patientService.list({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const { data: appointmentsAll = [], isLoading: loadingA } = useQuery({
    queryKey: ["appointments", "patients-enrich", "90d"],
    queryFn: () => {
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      return appointmentService.list({ from, limit: 500 })
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const patients = patientsRaw
  const appointments = appointmentsAll
  const isDataLoading = loadingP || loadingA
  const loadError = errP ? "No se pudo cargar el directorio de pacientes." : null

  // Enriquecer pacientes con datos de citas calculados
  const enrichedPatients = useMemo(() => {
    const now = new Date()

    return patients.map((patient) => {
      const attended = appointments
        .filter(
          (apt) =>
            apt.patientId === patient.id &&
            (apt.status === AppointmentStatus.COMPLETED ||
              apt.attendanceStatus === AttendanceStatus.ATTENDED)
        )
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      const latestAttended = attended[0]

      // Buscar cita programada próxima
      const upcomingApt = appointments
        .filter(
          (apt) =>
            apt.patientId === patient.id &&
            (apt.status === AppointmentStatus.CONFIRMED ||
              apt.status === AppointmentStatus.PENDING) &&
            new Date(apt.startTime).getTime() >= now.getTime() - 12 * 60 * 60 * 1000
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]

      return {
        ...patient,
        latestAttended,
        upcomingApt,
        age: patient.birthDate ? ageFrom(new Date(patient.birthDate), now) : null,
      }
    })
  }, [patients, appointments])

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

        return matchesQuery
      })
  }, [enrichedPatients, searchQuery])

  type PatientRow = (typeof enrichedPatients)[number]
  const columns: TableColumn<PatientRow>[] = [
    {
      key: "name",
      header: "Paciente",
      sortable: true,
      width: "26%",
      sortValue: (p) => p.name.toLocaleLowerCase("es"),
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
            {getInitials(p.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{p.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "age",
      header: "Edad",
      sortable: true,
      width: "120px",
      sortValue: (p) => p.age ?? (p.isMinor ? 0 : 999),
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
          <span className={p.isMinor ? "size-1.5 rounded-full bg-amber-500" : "size-1.5 rounded-full bg-primary"} />
          {p.isMinor ? "Menor" : "Adulto"}
          {p.age !== null && <span className="tabular-nums text-muted-foreground">· {p.age}</span>}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      width: "15%",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate text-xs tabular-nums text-foreground">{p.phone || "—"}</p>
          {p.isMinor && p.legalGuardian && (
            <p className="truncate text-[11px] text-muted-foreground">Tutor: {p.legalGuardian.name}</p>
          )}
        </div>
      ),
    },
    {
      key: "lastSession",
      header: "Última consulta",
      sortable: true,
      sortValue: (p) => (p.latestAttended ? new Date(p.latestAttended.startTime).getTime() : 0),
      cell: (p) =>
        p.latestAttended ? (
          <span className="text-xs text-foreground">{formatDate(new Date(p.latestAttended.startTime))}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin consultas</span>
        ),
    },
    {
      key: "nextAppointment",
      header: "Próxima cita",
      sortable: true,
      // Sin cita va al final al ordenar de la más cercana a la más lejana.
      sortValue: (p) => (p.upcomingApt ? new Date(p.upcomingApt.startTime).getTime() : Number.MAX_SAFE_INTEGER),
      cell: (p) =>
        p.upcomingApt ? (
          <span className="text-xs font-medium text-primary">{formatDate(new Date(p.upcomingApt.startTime))}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      width: "140px",
      cell: (p) => (
        <Link
          href={`/pacientes/${p.id}`}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Ver expediente
          <ChevronRight className="size-3.5" />
        </Link>
      ),
    },
  ]
  const ROW_HEIGHT = 56

  if (!isLoading && effectiveRole === UserRole.PATIENT) {
    router.replace("/dashboard")
    return null
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabecera Principal */}
      <PageHeader
        title="Directorio de Pacientes"
        description="Localiza expedientes clínicos, consulta asistencias recientes y gestiona el seguimiento terapéutico."
      />

      {loadError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {isDataLoading && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando pacientes…
        </div>
      )}

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

      {/* LISTA DE RESULTADOS (DATA GRID / TARJETAS) */}
      {isDataLoading ? null : filteredPatients.length > 0 ? (
        // Tabla: clic en un encabezado ordena; arrastrar su borde cambia el ancho.
        <Table
          data={filteredPatients}
          columns={columns}
          getRowId={(p) => p.id}
          defaultSort={{ key: "name", direction: "asc" }}
          resizable
          rowHeight={ROW_HEIGHT}
          // Crece con sus filas: la página hace el scroll (renderiza todas, son pocas).
          height="auto"
          overscan={filteredPatients.length}
          emptyState="No hay pacientes con este filtro."
          className="rounded-2xl border border-border/70 bg-card shadow-2xs"
        />
      ) : (
        /* ESTADO VACÍO (EMPTY STATE) */
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 sm:p-12 text-center space-y-4">
          <div className="mx-auto size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
            <UserX className="size-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-base text-foreground">
              No se encontraron pacientes registrados
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery
                ? `No hay registros clínicos que coincidan con "${searchQuery}".`
                : "No hay pacientes con el filtro seleccionado en este momento."}
            </p>
          </div>
          {searchQuery && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs rounded-xl h-9"
              >
                Limpiar búsqueda
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
