"use client"

import { useState, useMemo } from "react"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarClock, CalendarPlus, ChevronRight, History, Siren, Mail, Phone, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import {
  UserRole,
  AppointmentStatus,
  AttendanceStatus,
} from "@psicoagenda/shared"
import { usePatientsDirectoryData } from "./use-patients-directory-data"
import { PatientClinicalRecord } from "./[id]/patient-clinical-record"
import { useQuery } from "@tanstack/react-query"
import { patientService } from "@/services"


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

const diaCorto = (date: Date) => date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
const horaCorta = (date: Date) => date.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })


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
  const busqueda = useDebouncedValue(searchQuery)

  const {
    patients,
    appointments,
    isLoading: isDataLoading,
    error,
  } = usePatientsDirectoryData()

  const loadError = error ? "No se pudo cargar el directorio de pacientes." : null

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
        // Sesiones atendidas en los últimos 90 días (lo que trae el directorio).
        sesiones: attended.length,
        upcomingApt,
        age: patient.birthDate ? ageFrom(new Date(patient.birthDate), now) : null,
      }
    })
  }, [patients, appointments])

  // Filtrado reactivo de pacientes
  const filteredPatients = useMemo(() => {
    const query = busqueda.trim().toLowerCase()

    return enrichedPatients
      .filter((patient) => {
        // Por nombre, correo o teléfono (nunca por id: no se muestra en ningún lado).
        const matchesQuery =
          !query ||
          patient.name.toLowerCase().includes(query) ||
          patient.email.toLowerCase().includes(query) ||
          (patient.phone && patient.phone.toLowerCase().includes(query))

        return matchesQuery
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
  }, [enrichedPatients, busqueda])

  // Fichero: el paciente elegido se ve a la derecha. Sin elección, el primero de la lista.
  const [elegidoId, setElegidoId] = useState<string | null>(null)
  const elegido = filteredPatients.find((p) => p.id === elegidoId) ?? filteredPatients[0] ?? null
  // El contacto de emergencia no viene en la lista: se pide el detalle del elegido.
  const { data: detalle } = useQuery({
    queryKey: ["patients", "detalle", elegido?.id],
    queryFn: () => patientService.get(elegido!.id),
    enabled: Boolean(elegido),
    staleTime: 60_000,
  })
  const emergencia = detalle?.id === elegido?.id ? detalle?.emergencyContact : undefined

  // Agrupados por la inicial del nombre, como una libreta de contactos.
  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof filteredPatients>()
    for (const p of filteredPatients) {
      const letra = (p.name.trim()[0] ?? "#").toLocaleUpperCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      mapa.set(letra, [...(mapa.get(letra) ?? []), p])
    }
    return [...mapa]
  }, [filteredPatients])

  if (!isLoading && effectiveRole === UserRole.PATIENT) {
    router.replace("/dashboard")
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Pacientes" />

      {loadError && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* Lista: buscar y elegir. */}
        <section aria-label="Lista de pacientes" className="space-y-3 lg:sticky lg:top-24">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar paciente"
              aria-label="Buscar paciente por nombre, correo o teléfono"
              autoFocus
              className="h-11 rounded-xl pl-10 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {isDataLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando pacientes">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? `Nadie coincide con «${searchQuery}».` : "Aquí aparecerán tus pacientes cuando se registren."}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="rounded-xl">
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <p className="border-b border-border/50 px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
                {busqueda.trim()
                  ? `${filteredPatients.length} de ${patients.length} pacientes`
                  : `${patients.length} ${patients.length === 1 ? "paciente" : "pacientes"}`}
              </p>
              <div className="[scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] lg:max-h-[calc(100dvh-17rem)] lg:overflow-y-auto lg:overscroll-contain">
                {grupos.map(([letra, lista]) => (
                  <section key={letra} aria-label={`Letra ${letra}`}>
                    <h3 className="sticky top-0 z-10 bg-card/95 px-4 pb-0.5 pt-2.5 text-[11px] font-semibold text-muted-foreground backdrop-blur-sm">
                      {letra}
                    </h3>
                    <ul className="px-2 pb-1">
                      {lista.map((p) => {
                        const activo = elegido?.id === p.id
                        const proxima = p.upcomingApt ? new Date(p.upcomingApt.startTime) : null
                        return (
                          <li key={p.id}>
                            <Link
                              href={`/pacientes/${p.id}`}
                              // En pantalla grande, elegir muestra la ficha al lado; en celular abre el expediente.
                              onClick={(e) => {
                                if (window.matchMedia("(min-width: 1024px)").matches) {
                                  e.preventDefault()
                                  setElegidoId(p.id)
                                }
                              }}
                              aria-current={activo ? "true" : undefined}
                              className={`flex items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/40 ${
                                activo ? "hover:bg-muted/50 lg:bg-primary/10" : "hover:bg-muted/50"
                              } lg:py-1.5`}
                            >
                              <span
                                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold lg:size-8 lg:text-[11px] ${
                                  activo ? "bg-primary/10 text-primary lg:bg-primary lg:text-primary-foreground" : "bg-primary/10 text-primary"
                                }`}
                                aria-hidden="true"
                              >
                                {getInitials(p.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {p.oneTime && "Cita única · "}
                                  {proxima ? `Próxima: ${diaCorto(proxima)}` : p.isMinor ? "Menor de edad" : p.age !== null ? `${p.age} años` : "Sin citas próximas"}
                                </span>
                              </span>
                              {proxima && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Tiene cita próxima" />}
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 lg:hidden" aria-hidden="true" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Ficha del paciente elegido y, debajo, su expediente (solo pantalla grande). */}
        <div className="hidden min-w-0 space-y-6 lg:block">
        {elegido && !isDataLoading && (
          <article aria-labelledby="ficha-nombre" className="hidden rounded-2xl border border-border/60 bg-card lg:block">
            <header className="flex flex-wrap items-center gap-4 border-b border-border/50 p-6">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground" aria-hidden="true">
                {getInitials(elegido.name)}
              </span>
              <div className="min-w-0">
                <h2 id="ficha-nombre" className="text-xl font-semibold tracking-tight text-foreground">
                  {elegido.name}
                </h2>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {elegido.age !== null ? `${elegido.age} años` : "Edad sin registrar"}
                  {elegido.isMinor && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">Menor</span>
                  )}
                  {elegido.oneTime && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Cita única</span>
                  )}
                </p>
              </div>
              <Button asChild className="ml-auto rounded-xl active:scale-[0.97]">
                <Link href={`/agenda/nueva?patientId=${elegido.id}`}>
                  <CalendarPlus className="size-4" />
                  Agendar cita
                </Link>
              </Button>
            </header>

            {(() => {
              const proxima = elegido.upcomingApt ? new Date(elegido.upcomingApt.startTime) : null
              const ultima = elegido.latestAttended ? new Date(elegido.latestAttended.startTime) : null
              return (
                <div className="space-y-6 p-6">
                  {/* Lo que viene primero: la próxima cita es lo que más se consulta. */}
                  <div className={`rounded-xl p-4 ${proxima ? "bg-primary/[0.07]" : "bg-muted/40"}`}>
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      Próxima cita
                    </p>
                    <p className={`mt-1 text-base font-semibold ${proxima ? "text-foreground" : "text-muted-foreground"}`}>
                      {proxima ? `${diaCorto(proxima)} · ${horaCorta(proxima)}` : "Sin cita agendada"}
                    </p>
                  </div>

                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <History className="size-3.5" aria-hidden="true" />
                        Última sesión
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {ultima ? ultima.toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : "Aún sin sesiones"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <Siren className="size-3.5" aria-hidden="true" />
                        Contacto de emergencia
                      </dt>
                      <dd className="mt-0.5">
                        {emergencia ? (
                          <>
                            <span className="block truncate font-medium text-foreground">
                              {emergencia.name}
                              {emergencia.relationship && (
                                <span className="font-normal text-muted-foreground"> · {emergencia.relationship}</span>
                              )}
                            </span>
                            <a
                              href={`tel:${emergencia.phone.replace(/[^0-9+]/g, "")}`}
                              className="tabular-nums text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            >
                              {emergencia.phone}
                            </a>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{detalle ? "Sin contacto registrado" : "Cargando…"}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="size-3.5" aria-hidden="true" />
                        Teléfono
                      </dt>
                      <dd className="mt-0.5">
                        {elegido.phone ? (
                          <a href={`tel:${elegido.phone.replace(/[^0-9+]/g, "")}`} className="font-medium tabular-nums text-foreground underline-offset-4 hover:underline">
                            {elegido.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Sin teléfono</span>
                        )}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="size-3.5" aria-hidden="true" />
                        Correo
                      </dt>
                      <dd className="mt-0.5 truncate">
                        {elegido.email ? (
                          <a href={`mailto:${elegido.email}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                            {elegido.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Sin cuenta</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              )
            })()}

            <section aria-label={`Expediente de ${elegido.name}`} className="border-t border-border/50 p-6">
              <PatientClinicalRecord key={elegido.id} patientId={elegido.id} embebido />
            </section>
          </article>
        )}
        </div>
      </div>
    </div>
  )
}
