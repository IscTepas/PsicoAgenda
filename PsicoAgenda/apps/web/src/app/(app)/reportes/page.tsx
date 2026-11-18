"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { consultationReasonService } from "@/services"
import { AppointmentStatus, AttendanceStatus, type Appointment } from "@psicoagenda/shared"
import { useReportsData } from "./use-reports-data"
import { resumenDeMotivos, type ConteoDeMotivo } from "@/lib/motivos-cambio"
import Link from "next/link"
import {
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "../components/page-header"
import { DateRangePickerDropdown, type DateRangePreset } from "@/components/motion/date-range-picker"

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Atajos del período, calculados con la fecha local de hoy. */
function reportPresets(): DateRangePreset[] {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  return [
    { label: "Este mes", value: { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) } },
    { label: "Mes pasado", value: { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) } },
    { label: "Últimos 30 días", value: { from: isoDate(new Date(y, m, today.getDate() - 29)), to: isoDate(today) } },
    { label: "Este año", value: { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) } },
  ]
}

export type ReportAppointment = {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  patientId: string
  patientName: string
  status: "attended" | "cancelled" | "no_show" | "pending"
  fee: number
  modality: "in_person" | "virtual"
  /** Motivos del catálogo elegidos en la cita. */
  reasonIds: string[]
  reason: string
}

const REPORT_STATUS: Record<ReportAppointment["status"], { label: string; dot: string; order: number }> = {
  attended: { label: "Asistida", dot: "bg-primary", order: 0 },
  pending: { label: "Programada", dot: "bg-amber-500", order: 1 },
  no_show: { label: "Inasistencia", dot: "bg-muted-foreground/50", order: 2 },
  cancelled: { label: "Cancelada", dot: "bg-destructive", order: 3 },
}


const pad = (n: number) => String(n).padStart(2, "0")

function ListaDeMotivos({ titulo, motivos }: { titulo: string; motivos: ConteoDeMotivo[] }) {
  const total = motivos.reduce((suma, m) => suma + m.veces, 0)
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">
        {titulo} <span className="font-normal tabular-nums text-muted-foreground">({total})</span>
      </h3>
      {motivos.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Ninguna en este período.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {motivos.slice(0, 5).map((m) => (
            <li key={m.motivo} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words text-foreground">{m.motivo}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {m.veces} · {Math.round((m.veces / total) * 100)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(m.veces / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Cita de la API → fila del reporte (fecha y hora en la zona local). */
function toReportRow(apt: Appointment, patientName: string): ReportAppointment {
  const start = new Date(apt.startTime)
  const status: ReportAppointment["status"] =
    apt.status === AppointmentStatus.CANCELLED
      ? "cancelled"
      : apt.status === AppointmentStatus.NO_SHOW || apt.attendanceStatus === AttendanceStatus.NO_SHOW
        ? "no_show"
        : apt.status === AppointmentStatus.COMPLETED || apt.attendanceStatus === AttendanceStatus.ATTENDED
          ? "attended"
          : "pending"
  return {
    id: apt.id,
    date: isoDate(start),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    patientId: apt.patientId,
    patientName,
    status,
    // Una cita cancelada no genera honorario.
    fee: status === "cancelled" ? 0 : (apt.price ?? 0),
    modality: apt.modality === "virtual" ? "virtual" : "in_person",
    reasonIds: apt.reasonIds ?? [],
    reason: apt.reason || "Sin motivo registrado",
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount)
}

function statusLabel(status: ReportAppointment["status"]): string {
  switch (status) {
    case "attended":
      return "Asistida"
    case "cancelled":
      return "Cancelada"
    case "no_show":
      return "Inasistencia"
    default:
      return "Programada"
  }
}

function formatDate(dateStr: string, timeStr?: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  const formatted = d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  return timeStr ? `${formatted}, ${timeStr} hrs` : formatted
}

export default function ReportsPage() {

  // Filtros activos
  const [defaultRange] = useState(() => reportPresets()[0].value)
  const [fromDate, setFromDate] = useState(defaultRange.from)
  const [toDate, setToDate] = useState(defaultRange.to ?? defaultRange.from)
  const [statusFilter, setStatusFilter] = useState<"all" | ReportAppointment["status"]>("all")
  const [reasonFilter, setReasonFilter] = useState<string>("all")
  const { data: gruposDeMotivos = [] } = useQuery({
    queryKey: ["motivos-consulta"],
    queryFn: consultationReasonService.listActive,
    staleTime: 10 * 60_000,
  })
  const motivoPorId = useMemo(
    () => new Map(gruposDeMotivos.flatMap((g) => g.reasons).map((r) => [r.id, r.label])),
    [gruposDeMotivos],
  )

  // Los filtros se aplican al momento; el período solo cuenta cuando tiene inicio y fin.
  const [periodo, setPeriodo] = useState({ fromDate: defaultRange.from, toDate: defaultRange.to ?? defaultRange.from })
  if (fromDate && toDate && (fromDate !== periodo.fromDate || toDate !== periodo.toDate)) {
    setPeriodo({ fromDate, toDate })
  }
  const appliedFilters = { ...periodo, status: statusFilter, reason: reasonFilter }

  const [notification, setNotification] = useState<string | null>(null)

  // Datos reales: citas del período aplicado y nombres de los pacientes.
  const {
    appointments,
    patients,
    isFetching: isGenerating,
  } = useReportsData({ fromDate: appliedFilters.fromDate, toDate: appliedFilters.toDate })

  const records = useMemo(() => {
    const names = new Map(patients.map((p) => [p.id, p.name]))
    return appointments.map((apt) => toReportRow(apt, names.get(apt.patientId) ?? "Paciente"))
  }, [appointments, patients])

  const presets = useMemo(() => reportPresets(), [])

  // Filtrado reactivo de registros
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      // Filtro de fecha
      if (appliedFilters.fromDate && item.date < appliedFilters.fromDate) return false
      if (appliedFilters.toDate && item.date > appliedFilters.toDate) return false

      // Filtro de estado
      if (appliedFilters.status !== "all" && item.status !== appliedFilters.status) return false

      // Filtro de tipo de servicio
      if (appliedFilters.reason !== "all" && !item.reasonIds.includes(appliedFilters.reason)) return false

      return true
    })
  }, [appliedFilters.fromDate, appliedFilters.toDate, appliedFilters.status, appliedFilters.reason, records])

  // Cálculo de KPIs
  // Por qué se cancelan o se mueven las citas del período (no depende de los filtros de la tabla).
  const motivos = useMemo(() => resumenDeMotivos(appointments), [appointments])
  const totalConsultations = filteredRecords.length
  const totalAttended = filteredRecords.filter((r) => r.status === "attended").length
  const totalCancelled = filteredRecords.filter((r) => r.status === "cancelled").length
  const totalNoShow = filteredRecords.filter((r) => r.status === "no_show").length
  const totalPending = filteredRecords.filter((r) => r.status === "pending").length
  const ocurridas = totalAttended + totalNoShow
  const attendanceRate = ocurridas > 0 ? Math.round((totalAttended / ocurridas) * 100) : null
  const totalFees = filteredRecords.reduce((acc, curr) => acc + curr.fee, 0)

  // Exportar a Excel (CSV real)
  const handleExportCSV = () => {
    // Cada celda entre comillas (y las comillas internas duplicadas): un "#" o una coma ya no rompen el archivo.
    const celda = (v: string) => `"${v.replace(/"/g, '""')}"`
    const headers = ["Fecha", "Hora", "Paciente", "Estado", "Modalidad", "Motivo de consulta", "Honorario (MXN)"]
    const rows = [...filteredRecords]
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .map((r) => [
        r.date,
        r.time,
        r.patientName,
        statusLabel(r.status),
        r.modality === "in_person" ? "Presencial" : "En línea",
        r.reason,
        r.fee.toFixed(2),
      ])
    // BOM para que Excel lea los acentos.
    const csv = "\uFEFF" + [headers, ...rows].map((fila) => fila.map(celda).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `reporte_consultorio_${appliedFilters.fromDate}_a_${appliedFilters.toDate}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setNotification(`Se descargó el reporte con ${rows.length} ${rows.length === 1 ? "cita" : "citas"}.`)
    setTimeout(() => setNotification(null), 3500)
  }

  // Exportar a PDF (simulación y aviso)
  const handleExportPDF = () => {
    // En la ventana de impresión se elige "Guardar como PDF".
    window.print()
  }

  // Consultas por semana (lunes a domingo), apiladas por estado.
  const ORDEN_ESTADOS: ReportAppointment["status"][] = ["attended", "pending", "no_show", "cancelled"]
  const semanas = (() => {
    const mapa = new Map<string, Record<ReportAppointment["status"], number>>()
    for (const r of filteredRecords) {
      const d = new Date(`${r.date}T12:00:00`)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const clave = isoDate(d)
      const fila = mapa.get(clave) ?? { attended: 0, pending: 0, no_show: 0, cancelled: 0 }
      fila[r.status] += 1
      mapa.set(clave, fila)
    }
    return [...mapa].sort(([a], [b]) => a.localeCompare(b))
  })()
  const maxSemana = Math.max(1, ...semanas.map(([, c]) => ORDEN_ESTADOS.reduce((t, k) => t + c[k], 0)))

  // Por tipo de servicio y por modalidad (sin canceladas: no ocurrieron).
  const vigentes = filteredRecords.filter((r) => r.status !== "cancelled")
  // Una cita con dos motivos cuenta en los dos.
  const porMotivo = (() => {
    const mapa = new Map<string, number>()
    for (const r of vigentes) {
      const etiquetas = r.reasonIds.map((id) => motivoPorId.get(id)).filter((e): e is string => Boolean(e))
      for (const e of etiquetas.length > 0 ? etiquetas : ["Sin motivo registrado"]) mapa.set(e, (mapa.get(e) ?? 0) + 1)
    }
    return [...mapa].map(([etiqueta, n]) => ({ etiqueta, n })).sort((a, b) => b.n - a.n)
  })()
  const maxMotivo = Math.max(1, ...porMotivo.map((x) => x.n))
  const presenciales = vigentes.filter((r) => r.modality === "in_person").length
  const virtuales = vigentes.length - presenciales

  // Pacientes con más consultas en el período.
  const topPacientes = (() => {
    const mapa = new Map<string, { id: string; nombre: string; n: number; monto: number }>()
    for (const r of vigentes) {
      const p = mapa.get(r.patientId) ?? { id: r.patientId, nombre: r.patientName, n: 0, monto: 0 }
      p.n += 1
      p.monto += r.fee
      mapa.set(r.patientId, p)
    }
    return [...mapa.values()].sort((a, b) => b.n - a.n || b.monto - a.monto).slice(0, 5)
  })()

  const cifras: { etiqueta: string; valor: string; detalle: string }[] = [
    {
      etiqueta: "Consultas",
      valor: String(totalConsultations),
      detalle: totalPending > 0 ? `${totalAttended} asistidas · ${totalPending} por venir` : `${totalAttended} asistidas`,
    },
    {
      etiqueta: "Asistencia",
      valor: attendanceRate === null ? "—" : `${attendanceRate}%`,
      detalle: ocurridas > 0 ? `de ${ocurridas} citas ya ocurridas` : "Aún sin citas ocurridas",
    },
    {
      etiqueta: "Cancelaciones",
      valor: String(totalCancelled),
      detalle: totalNoShow > 0 ? `y ${totalNoShow} inasistencias` : "Sin inasistencias",
    },
    { etiqueta: "Honorarios", valor: formatCurrency(totalFees), detalle: "Sin contar canceladas" },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 print:max-w-none">
      <PageHeader
        title="Reportes"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-1.5 rounded-xl px-3.5 active:scale-[0.97] print:hidden">
                <Download className="size-4" />
                Exportar
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
              <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer gap-2 rounded-lg py-2 text-sm">
                <FileText className="size-4 text-primary" />
                Imprimir o guardar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer gap-2 rounded-lg py-2 text-sm">
                <FileSpreadsheet className="size-4 text-primary" />
                Descargar para Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {notification && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-foreground print:hidden">
          <Check className="size-4 text-primary" />
          {notification}
        </p>
      )}

      {/* Qué se está viendo: período y filtros, en una sola línea que cambia el reporte al momento. */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <DateRangePickerDropdown
          label="Período del reporte"
          value={fromDate ? { from: fromDate, to: toDate || undefined } : null}
          onValueChange={(range) => {
            setFromDate(range?.from ?? "")
            setToDate(range?.to ?? "")
          }}
          presets={presets}
          closeOnSelect
          placeholder="Elige el período"
          className="flex"
          triggerClassName="h-9 min-w-56 justify-between rounded-xl text-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)} className="w-44">
          <SelectTrigger className="h-9 rounded-xl text-sm" aria-label="Estado de la cita">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.keys(REPORT_STATUS) as ReportAppointment["status"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {REPORT_STATUS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={setReasonFilter} className="w-60">
          <SelectTrigger className="h-9 rounded-xl text-sm" aria-label="Motivo de consulta">
            <SelectValue placeholder="Todos los motivos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los motivos</SelectItem>
            {[...motivoPorId].map(([id, etiqueta]) => (
              <SelectItem key={id} value={id}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isGenerating && <span className="text-sm text-muted-foreground">Actualizando…</span>}
        {fromDate && !toDate && <span role="alert" className="text-sm text-destructive">Elige también la fecha final.</span>}
        {/* Al imprimir, el período va escrito. */}
        <p className="hidden print:block">
          Período: {formatDate(appliedFilters.fromDate)} al {formatDate(appliedFilters.toDate)}
        </p>
      </div>

      {/* Cifras del período: una franja, no cuatro tarjetas. */}
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/60 bg-card lg:grid-cols-4">
        {cifras.map((c, idx) => (
          <div
            key={c.etiqueta}
            className={`space-y-1 p-5 ${idx > 0 ? "border-border/50 lg:border-l" : ""} ${idx % 2 === 1 ? "border-l border-border/50" : ""} ${idx >= 2 ? "border-t border-border/50 lg:border-t-0" : ""}`}
          >
            <dt className="text-xs font-medium text-muted-foreground">{c.etiqueta}</dt>
            <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{c.valor}</dd>
            <dd className="text-xs text-muted-foreground">{c.detalle}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Consultas por semana: barras apiladas por estado. */}
        <section aria-labelledby="semanas-titulo" className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="semanas-titulo" className="text-sm font-semibold text-foreground">
              Consultas por semana
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
              {ORDEN_ESTADOS.map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${REPORT_STATUS[k].dot}`} aria-hidden="true" />
                  {REPORT_STATUS[k].label}
                </li>
              ))}
            </ul>
          </div>
          {semanas.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No hay citas con estos filtros.</p>
          ) : (
            <div
              className="mt-6 flex h-56 items-end gap-4 border-b border-border/60 px-2"
              role="list"
              style={{ backgroundImage: "linear-gradient(to top, var(--border) 1px, transparent 1px)", backgroundSize: "100% 25%" }}
            >
              {semanas.map(([inicio, conteo]) => {
                const total = ORDEN_ESTADOS.reduce((t, k) => t + conteo[k], 0)
                const etiqueta = new Date(`${inicio}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
                const resumen = ORDEN_ESTADOS.filter((k) => conteo[k] > 0)
                  .map((k) => `${conteo[k]} ${REPORT_STATUS[k].label.toLowerCase()}`)
                  .join(", ")
                return (
                  <div
                    key={inicio}
                    role="listitem"
                    className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    aria-label={`Semana del ${etiqueta}: ${total} consultas (${resumen})`}
                  >
                    <span className="mb-1 text-xs font-medium tabular-nums text-foreground">{total}</span>
                    {/* Segmentos con 2px de separación; el de arriba con esquinas redondeadas. */}
                    <div className="flex w-full max-w-20 flex-col-reverse gap-0.5" style={{ height: `${(total / maxSemana) * 85}%` }}>
                      {ORDEN_ESTADOS.filter((k) => conteo[k] > 0).map((k, i, arr) => (
                        <div
                          key={k}
                          className={`w-full ${REPORT_STATUS[k].dot} ${i === arr.length - 1 ? "rounded-t-[4px]" : ""}`}
                          style={{ flexGrow: conteo[k] }}
                        />
                      ))}
                    </div>
                    {/* Detalle al pasar el cursor. */}
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-hover:block">
                      <p className="font-medium">Semana del {etiqueta}</p>
                      {ORDEN_ESTADOS.filter((k) => conteo[k] > 0).map((k) => (
                        <p key={k} className="flex items-center gap-1.5 text-muted-foreground">
                          <span className={`size-1.5 rounded-full ${REPORT_STATUS[k].dot}`} aria-hidden="true" />
                          {REPORT_STATUS[k].label}: <span className="tabular-nums text-foreground">{conteo[k]}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {semanas.length > 0 && (
            <div className="mt-2 flex gap-4 px-2" aria-hidden="true">
              {semanas.map(([inicio]) => (
                <span key={inicio} className="flex-1 text-center text-xs text-muted-foreground">
                  {new Date(`${inicio}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
          )}
        </section>

        <aside aria-labelledby="motivos-titulo" className="space-y-5 rounded-2xl border border-border/60 bg-card p-5">
          <h2 id="motivos-titulo" className="text-sm font-semibold text-foreground">
            Por qué se cancelan o cambian
          </h2>
          <ListaDeMotivos titulo="Cancelaciones" motivos={motivos.cancelaciones} />
          <ListaDeMotivos titulo="Cambios de fecha" motivos={motivos.cambios} />
        </aside>

        {/* Por motivo de consulta */}
        <section aria-labelledby="motivo-titulo" className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
          <h2 id="motivo-titulo" className="text-sm font-semibold text-foreground">
            Motivos de consulta
          </h2>
          {porMotivo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consultas en el período.</p>
          ) : (
            <ul className="space-y-3">
              {porMotivo.slice(0, 6).map((x) => (
                <li key={x.etiqueta} className="space-y-1 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-foreground">{x.etiqueta}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{x.n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(x.n / maxMotivo) * 100}%` }} />
                  </div>
                </li>
              ))}
              {porMotivo.length > 6 && (
                <li className="text-xs text-muted-foreground">y {porMotivo.length - 6} motivos más</li>
              )}
            </ul>
          )}
        </section>

        {/* Por modalidad: una barra partida en dos. */}
        <section aria-labelledby="modalidad-titulo" className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
          <h2 id="modalidad-titulo" className="text-sm font-semibold text-foreground">
            Presencial y en línea
          </h2>
          {vigentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consultas en el período.</p>
          ) : (
            <>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {presenciales > 0 && <div className="bg-primary" style={{ flexGrow: presenciales }} />}
                {virtuales > 0 && <div className="bg-primary/40" style={{ flexGrow: virtuales }} />}
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                    Presencial
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    {presenciales}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {Math.round((presenciales / vigentes.length) * 100)}%
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-primary/40" aria-hidden="true" />
                    En línea
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    {virtuales}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {Math.round((virtuales / vigentes.length) * 100)}%
                    </span>
                  </dd>
                </div>
              </dl>
            </>
          )}
        </section>

        {/* Pacientes con más consultas */}
        <section aria-labelledby="top-titulo" className="space-y-3 rounded-2xl border border-border/60 bg-card p-5">
          <h2 id="top-titulo" className="text-sm font-semibold text-foreground">
            Pacientes con más consultas
          </h2>
          {topPacientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consultas en el período.</p>
          ) : (
            <ol className="space-y-1">
              {topPacientes.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/pacientes/${p.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50"
                  >
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{p.nombre}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.n} {p.n === 1 ? "consulta" : "consultas"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
