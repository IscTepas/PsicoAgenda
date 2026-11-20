"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { appointmentService, consultationReasonService } from "@/services"
import { AppointmentStatus, AttendanceStatus, PaymentStatus, type Appointment } from "@psicoagenda/shared"
import { useReportsData } from "./use-reports-data"
import { resumenDeMotivos } from "@/lib/motivos-cambio"
import { periodoAnterior } from "@/lib/periodo"
import Link from "next/link"
import { Download, FileSpreadsheet, FileText, ChevronDown, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "../components/page-header"
import { CobroDeCita } from "@/components/cobro-cita"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  /** Estado del cobro; `null` si la cita no tiene cobro registrado. */
  pago: PaymentStatus | null
  /** Lo que de verdad entró (solo pagos marcados como pagados). */
  cobrado: number
  modality: "in_person" | "virtual"
  /** Motivos del catálogo elegidos en la cita. */
  reasonIds: string[]
  reason: string
}

const REPORT_STATUS: Record<ReportAppointment["status"], { label: string; dot: string }> = {
  attended: { label: "Asistida", dot: "bg-primary" },
  pending: { label: "Programada", dot: "bg-primary/35" },
  no_show: { label: "Inasistencia", dot: "bg-amber-500" },
  cancelled: { label: "Cancelada", dot: "bg-muted-foreground/40" },
}
const ORDEN_ESTADOS: ReportAppointment["status"][] = ["attended", "pending", "no_show", "cancelled"]

const pad = (n: number) => String(n).padStart(2, "0")

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
  const pago = status === "cancelled" ? null : (apt.payment?.status ?? null)
  return {
    id: apt.id,
    date: isoDate(start),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    patientId: apt.patientId,
    patientName,
    status,
    // Una cita cancelada no genera honorario.
    // Lo que se cobra: el monto del cobro (si se ajustó) o la tarifa de la cita.
    fee: status === "cancelled" ? 0 : Number(apt.payment?.amount ?? apt.price ?? 0),
    pago,
    cobrado: pago === PaymentStatus.PAID ? Number(apt.payment?.amount ?? apt.price ?? 0) : 0,
    modality: apt.modality === "virtual" ? "virtual" : "in_person",
    reasonIds: apt.reasonIds ?? [],
    reason: apt.reason || "Sin motivo registrado",
  }
}

/**
 * Sesión atendida sin cobro registrado. Desde que el cobro se registra al cerrar
 * la sesión ya no se generan; solo quedan las cerradas antes de esa regla.
 */
const porCobrar = (r: ReportAppointment) =>
  r.status === "attended" && r.fee > 0 && r.pago !== PaymentStatus.PAID && r.pago !== PaymentStatus.WAIVED

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(amount)

function formatDate(dateStr: string, timeStr?: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const formatted = new Date(year, month - 1, day).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  return timeStr ? `${formatted}, ${timeStr} hrs` : formatted
}

const fechaCorta = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })

const PAGO_CSV: Record<PaymentStatus, string> = {
  [PaymentStatus.PAID]: "Pagado",
  [PaymentStatus.PENDING]: "Sin registrar",
  [PaymentStatus.WAIVED]: "Condonado",
}

/** Resumen de las citas del período, para el período elegido y el anterior. */
function resumir(filas: ReportAppointment[]) {
  const asistidas = filas.filter((r) => r.status === "attended").length
  const faltas = filas.filter((r) => r.status === "no_show").length
  const ocurridas = asistidas + faltas
  return {
    asistidas,
    faltas,
    canceladas: filas.filter((r) => r.status === "cancelled").length,
    programadas: filas.filter((r) => r.status === "pending").length,
    asistencia: ocurridas > 0 ? Math.round((asistidas / ocurridas) * 100) : null,
    ocurridas,
    cobrado: filas.reduce((t, r) => t + r.cobrado, 0),
    pendientes: filas.filter(porCobrar),
  }
}

type Fila = { clave: string; etiqueta: string; n: number; href?: string; detalle?: string }

/**
 * Lista ordenada estilo analítica web (Plausible, Fathom): cada renglón lleva su
 * barra de fondo, el número a la derecha y el porcentaje atenuado. Se lee de un
 * vistazo y no compite con el texto.
 */
function Ranking({
  filas,
  columna,
  total,
  vacio,
  max = 6,
}: {
  filas: Fila[]
  columna: string
  total: number
  vacio: string
  max?: number
}) {
  if (filas.length === 0) return <p className="py-6 text-sm text-muted-foreground">{vacio}</p>
  const mayor = Math.max(...filas.map((f) => f.n))
  const visibles = filas.slice(0, max)
  return (
    <div>
      <div className="flex justify-between px-2 pb-1.5 text-xs text-muted-foreground" aria-hidden="true">
        <span>{columna}</span>
        <span className="flex gap-3">
          <span>Citas</span>
          <span className="w-9 text-right">%</span>
        </span>
      </div>
      <ol className="space-y-1">
        {visibles.map((f) => {
          const contenido = (
            <>
              <span
                className="absolute inset-y-0 left-0 rounded-md bg-primary/10 transition-[width] duration-500 ease-out"
                style={{ width: `${(f.n / mayor) * 100}%` }}
                aria-hidden="true"
              />
              <span className="relative min-w-0 flex-1 truncate text-foreground" title={f.etiqueta}>
                {f.etiqueta}
                {f.detalle && <span className="ml-2 text-xs text-muted-foreground">{f.detalle}</span>}
              </span>
              <span className="relative flex shrink-0 gap-3 tabular-nums">
                <span className="font-medium text-foreground">{f.n}</span>
                <span className="w-9 text-right text-muted-foreground">{Math.round((f.n / total) * 100)}%</span>
              </span>
            </>
          )
          const clase = "relative flex h-9 items-center gap-3 rounded-md px-2 text-sm"
          return (
            <li key={f.clave}>
              {f.href ? (
                <Link href={f.href} className={`${clase} outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring`}>
                  {contenido}
                </Link>
              ) : (
                <div className={clase}>{contenido}</div>
              )}
            </li>
          )
        })}
      </ol>
      {filas.length > max && (
        <p className="px-2 pt-2 text-xs text-muted-foreground">y {filas.length - max} más con menos citas</p>
      )}
    </div>
  )
}

function Tarjeta({ id, titulo, extra, className = "", children }: {
  id: string
  titulo: string
  extra?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className={`rounded-2xl border border-border/60 bg-card p-5 break-inside-avoid ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

export default function ReportsPage() {
  // Filtros activos
  const [defaultRange] = useState(() => reportPresets()[0].value)
  const [fromDate, setFromDate] = useState(defaultRange.from)
  const [toDate, setToDate] = useState(defaultRange.to ?? defaultRange.from)
  const [statusFilter, setStatusFilter] = useState<"all" | ReportAppointment["status"]>("all")
  const [reasonFilter, setReasonFilter] = useState<string>("all")
  const [verCambios, setVerCambios] = useState(false)
  const [verTodasSinCobrar, setVerTodasSinCobrar] = useState(false)
  const [cobrando, setCobrando] = useState<string | null>(null)
  const [citaDeCobro, setCitaDeCobro] = useState<string | null>(null)
  const queryClient = useQueryClient()
  // Cobro rápido desde la lista: el monto es el de la cita; para ajustarlo se abre la cita.
  const marcarCobrada = async (id: string) => {
    setCobrando(id)
    try {
      await appointmentService.updatePayment(id, PaymentStatus.PAID)
      await queryClient.invalidateQueries({ queryKey: ["reports"] })
      void queryClient.invalidateQueries({ queryKey: ["appointments"] })
    } catch (err) {
      setNotification(err instanceof Error ? err.message : "No se pudo marcar como cobrada.")
    } finally {
      setCobrando(null)
    }
  }
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
  const anterior = periodoAnterior(periodo.fromDate, periodo.toDate)

  const [notification, setNotification] = useState<string | null>(null)

  // Datos reales: citas del período y del anterior (para comparar), y nombres de los pacientes.
  const { appointments, patients, isFetching: isGenerating } = useReportsData(periodo)
  const { appointments: citasAnteriores } = useReportsData({ fromDate: anterior.desde, toDate: anterior.hasta })

  const nombres = useMemo(() => new Map(patients.map((p) => [p.id, p.name])), [patients])
  const records = useMemo(
    () => appointments.map((apt) => toReportRow(apt, nombres.get(apt.patientId) ?? "Paciente")),
    [appointments, nombres],
  )
  const presets = useMemo(() => reportPresets(), [])

  const filteredRecords = useMemo(
    () =>
      records.filter(
        (item) =>
          item.date >= periodo.fromDate &&
          item.date <= periodo.toDate &&
          (statusFilter === "all" || item.status === statusFilter) &&
          (reasonFilter === "all" || item.reasonIds.includes(reasonFilter)),
      ),
    [records, periodo, statusFilter, reasonFilter],
  )

  const actual = resumir(filteredRecords)
  // El anterior se compara con los mismos filtros de estado y motivo.
  const previo = resumir(
    citasAnteriores
      .map((apt) => toReportRow(apt, ""))
      .filter(
        (r) =>
          (statusFilter === "all" || r.status === statusFilter) &&
          (reasonFilter === "all" || r.reasonIds.includes(reasonFilter)),
      ),
  )
  const totalPorCobrar = actual.pendientes.reduce((t, r) => t + r.fee, 0)

  // Por qué se cancelan o se mueven las citas del período (no depende de los filtros).
  const motivos = useMemo(() => resumenDeMotivos(appointments), [appointments])

  // El navegador usa el título de la página como nombre del PDF.
  const imprimir = () => {
    const anterior = document.title
    document.title = `Reporte del consultorio ${periodo.fromDate} a ${periodo.toDate}`
    window.print()
    document.title = anterior
  }

  const handleExportCSV = () => {
    // Cada celda entre comillas (y las comillas internas duplicadas): un "#" o una coma ya no rompen el archivo.
    const celda = (v: string) => `"${v.replace(/"/g, '""')}"`
    const headers = ["Fecha", "Hora", "Paciente", "Estado", "Modalidad", "Motivo de consulta", "Honorario (MXN)", "Cobro"]
    const rows = [...filteredRecords]
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .map((r) => [
        r.date,
        r.time,
        r.patientName,
        REPORT_STATUS[r.status].label,
        r.modality === "in_person" ? "Presencial" : "En línea",
        r.reason,
        r.fee.toFixed(2),
        r.pago ? PAGO_CSV[r.pago] : r.status === "cancelled" ? "" : "Sin registrar",
      ])
    // BOM para que Excel lea los acentos.
    const csv = "﻿" + [headers, ...rows].map((fila) => fila.map(celda).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `reporte_consultorio_${periodo.fromDate}_a_${periodo.toDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setNotification(`Se descargó el reporte con ${rows.length} ${rows.length === 1 ? "cita" : "citas"}.`)
    setTimeout(() => setNotification(null), 3500)
  }

  // Consultas por semana (lunes a domingo), apiladas por estado.
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

  // Motivos, modalidad y pacientes: solo citas que sí ocurrieron o van a ocurrir.
  const vigentes = filteredRecords.filter((r) => r.status !== "cancelled")
  const contar = (claves: [string, string, string?][]): Fila[] => {
    const mapa = new Map<string, Fila>()
    for (const [clave, etiqueta, href] of claves) {
      const f = mapa.get(clave) ?? { clave, etiqueta, n: 0, href }
      f.n += 1
      mapa.set(clave, f)
    }
    return [...mapa.values()].sort((a, b) => b.n - a.n)
  }
  // Una cita con dos motivos cuenta en los dos.
  const porMotivo = contar(
    vigentes.flatMap((r) => {
      const etiquetas = r.reasonIds.map((id) => motivoPorId.get(id)).filter((e): e is string => Boolean(e))
      return (etiquetas.length > 0 ? etiquetas : ["Sin motivo registrado"]).map((e): [string, string] => [e, e])
    }),
  )
  const porModalidad = contar(
    vigentes.map((r): [string, string] => (r.modality === "in_person" ? ["p", "Presencial"] : ["v", "En línea"])),
  )
  const porPaciente = contar(vigentes.map((r): [string, string, string] => [r.patientId, r.patientName, `/pacientes/${r.patientId}`]))
  // Faltas por paciente, para avisar a quién darle seguimiento.
  const faltasDe = new Map<string, number>()
  for (const r of filteredRecords) if (r.status === "no_show") faltasDe.set(r.patientId, (faltasDe.get(r.patientId) ?? 0) + 1)
  for (const f of porPaciente) {
    const faltas = faltasDe.get(f.clave)
    if (faltas) f.detalle = `${faltas} ${faltas === 1 ? "falta" : "faltas"}`
  }

  const listaCambios = verCambios ? motivos.cambios : motivos.cancelaciones
  const totalCambios = listaCambios.reduce((t, m) => t + m.veces, 0)

  const comparar = (ahora: number, antes: number, formato: (n: number) => string = String) =>
    `${ahora === antes ? "Igual que" : ahora > antes ? "Más que" : "Menos que"} el período anterior (${formato(antes)})`

  const cifras: { etiqueta: string; valor: string; detalle: string; tono?: "aviso" }[] = [
    {
      etiqueta: "Sesiones atendidas",
      valor: String(actual.asistidas),
      detalle:
        actual.programadas > 0
          ? `${actual.programadas} más por venir · ${comparar(actual.asistidas, previo.asistidas).toLowerCase()}`
          : comparar(actual.asistidas, previo.asistidas),
    },
    {
      etiqueta: "Asistencia",
      valor: actual.asistencia === null ? "—" : `${actual.asistencia}%`,
      detalle:
        actual.ocurridas === 0
          ? "Aún sin citas ocurridas"
          : `${actual.faltas} ${actual.faltas === 1 ? "falta" : "faltas"} · ${actual.canceladas} ${actual.canceladas === 1 ? "cancelada" : "canceladas"}${previo.asistencia === null ? "" : ` · antes ${previo.asistencia}%`}`,
    },
    {
      etiqueta: "Cobrado",
      valor: formatCurrency(actual.cobrado),
      detalle: comparar(actual.cobrado, previo.cobrado, formatCurrency),
    },
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
              <DropdownMenuItem onClick={imprimir} className="cursor-pointer gap-2 rounded-lg py-2 text-sm">
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
            {ORDEN_ESTADOS.map((k) => (
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
      </div>
      {/* Al imprimir, el período va escrito. */}
      <p className="hidden text-sm print:block">
        Período: {formatDate(periodo.fromDate)} al {formatDate(periodo.toDate)}
      </p>

      {/* Cifras del período: una franja de tres, no tarjetas sueltas. */}
      <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border/60 bg-card sm:grid-cols-3">
        {cifras.map((c, idx) => (
          <div
            key={c.etiqueta}
            className={`space-y-1 p-5 ${idx > 0 ? "border-t border-border/50 sm:border-l sm:border-t-0" : ""}`}
          >
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {c.tono === "aviso" && <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />}
              {c.etiqueta}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{c.valor}</dd>
            <dd className="text-xs leading-relaxed text-muted-foreground">{c.detalle}</dd>
          </div>
        ))}
      </dl>

      {/* Dos columnas que se apilan solas: cada tarjeta mide lo que su contenido y no quedan huecos. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Consultas por semana: barras apiladas por estado. */}
          <Tarjeta
            id="semanas-titulo"
            titulo="Citas por semana"
           
            extra={
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
                {ORDEN_ESTADOS.map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${REPORT_STATUS[k].dot}`} aria-hidden="true" />
                    {REPORT_STATUS[k].label}
                  </li>
                ))}
              </ul>
            }
          >
            {semanas.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No hay citas con estos filtros.</p>
            ) : (
              <>
                <div
                  className="mt-2 flex h-56 items-end gap-4 border-b border-border/60 px-2"
                  role="list"
                  style={{ backgroundImage: "linear-gradient(to top, var(--border) 1px, transparent 1px)", backgroundSize: "100% 25%" }}
                >
                  {semanas.map(([inicio, conteo]) => {
                    const total = ORDEN_ESTADOS.reduce((t, k) => t + conteo[k], 0)
                    const etiqueta = fechaCorta(inicio)
                    const resumen = ORDEN_ESTADOS.filter((k) => conteo[k] > 0)
                      .map((k) => `${conteo[k]} ${REPORT_STATUS[k].label.toLowerCase()}`)
                      .join(", ")
                    return (
                      <div
                        key={inicio}
                        role="listitem"
                        className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                        aria-label={`Semana del ${etiqueta}: ${total} citas (${resumen})`}
                      >
                        <span className="mb-1 text-xs font-medium tabular-nums text-foreground">{total}</span>
                        {/* Segmentos con 2px de separación; el de arriba con esquinas redondeadas. */}
                        <div className="flex w-full max-w-16 flex-col-reverse gap-0.5" style={{ height: `${(total / maxSemana) * 85}%` }}>
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
                <div className="mt-2 flex gap-4 px-2" aria-hidden="true">
                  {semanas.map(([inicio]) => (
                    <span key={inicio} className="flex-1 text-center text-xs text-muted-foreground">
                      {fechaCorta(inicio)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Tarjeta>

          <Tarjeta id="motivo-titulo" titulo="Motivos de consulta">
            <Ranking
              filas={porMotivo}
              columna="Motivo"
              total={vigentes.length}
              vacio="Sin citas en el período."
            />
          </Tarjeta>

          <Tarjeta id="top-titulo" titulo="Pacientes con más citas">
            <Ranking
              filas={porPaciente}
              columna="Paciente"
              total={vigentes.length}
              vacio="Sin citas en el período."
            />
          </Tarjeta>

        </div>
        <div className="space-y-6">
          {/* Solo aparece si quedan sesiones cerradas antes de que el cobro fuera parte del cierre. */}
          {actual.pendientes.length > 0 && (
          <Tarjeta
            id="cobros-titulo"
            titulo="Cobros por regularizar"
            extra={
              actual.pendientes.length > 0 && (
                <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(totalPorCobrar)}</span>
              )
            }
          >
            <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Sesiones atendidas antes de que el cobro se registrara al cerrarlas. Regístralas una vez y esta lista desaparece.
                </p>
                <ol className="-mx-2 divide-y divide-border/50">
                  {[...actual.pendientes]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(0, verTodasSinCobrar ? undefined : 6)
                    .map((r) => (
                      <li key={r.id} className="flex items-center gap-2 px-2 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => setCitaDeCobro(r.id)}
                          className="min-w-0 flex-1 rounded-md text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block truncate font-medium text-foreground">{r.patientName}</span>
                          <span className="block text-xs text-muted-foreground">{fechaCorta(r.date)}, {r.time}</span>
                        </button>
                        <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(r.fee)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 print:hidden"
                          disabled={cobrando !== null}
                          aria-busy={cobrando === r.id}
                          aria-label={`Registrar el cobro de la sesión de ${r.patientName} del ${fechaCorta(r.date)}`}
                          onClick={() => void marcarCobrada(r.id)}
                        >
                          {cobrando === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          Registrar
                        </Button>
                      </li>
                    ))}
                </ol>
                {actual.pendientes.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setVerTodasSinCobrar((v) => !v)}
                    className="pt-2 text-xs font-medium text-primary hover:underline print:hidden"
                  >
                    {verTodasSinCobrar ? "Ver menos" : `Ver las ${actual.pendientes.length}`}
                  </button>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Toca la sesión para registrar un monto distinto.
                </p>
            </>
          </Tarjeta>
          )}
          <Tarjeta
            id="cambios-titulo"
            titulo="Por qué se cancelan o cambian"
            extra={
              // Dos vistas de la misma pregunta; un control segmentado en vez de dos listas apiladas.
              <div role="tablist" aria-label="Tipo de cambio" className="flex rounded-lg bg-muted/60 p-0.5 text-xs">
                {[
                  { valor: false, etiqueta: "Cancelaciones", n: motivos.cancelaciones.reduce((t, m) => t + m.veces, 0) },
                  { valor: true, etiqueta: "Cambios de fecha", n: motivos.cambios.reduce((t, m) => t + m.veces, 0) },
                ].map((o) => (
                  <button
                    key={o.etiqueta}
                    type="button"
                    role="tab"
                    aria-selected={verCambios === o.valor}
                    onClick={() => setVerCambios(o.valor)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${verCambios === o.valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {o.etiqueta} <span className="tabular-nums opacity-70">{o.n}</span>
                  </button>
                ))}
              </div>
            }
          >
            <Ranking
              filas={listaCambios.map((m) => ({ clave: m.motivo, etiqueta: m.motivo, n: m.veces }))}
              columna="Motivo"
              total={totalCambios}
              vacio={verCambios ? "Nadie cambió de fecha en este período." : "Ninguna cita se canceló en este período."}
            />
          </Tarjeta>

          <Tarjeta id="modalidad-titulo" titulo="Presencial y en línea">
            <Ranking filas={porModalidad} columna="Modalidad" total={vigentes.length} vacio="Sin citas en el período." />
          </Tarjeta>
        </div>
      </div>
      {/* Ajustar el cobro de una sesión sin salir del reporte. */}
      {(() => {
        const cita = appointments.find((a) => a.id === citaDeCobro)
        if (!cita) return null
        return (
          <Dialog open onOpenChange={(open) => !open && setCitaDeCobro(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{nombres.get(cita.patientId) ?? "Paciente"}</DialogTitle>
                <DialogDescription>
                  Sesión del {new Date(cita.startTime).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                </DialogDescription>
              </DialogHeader>
              <CobroDeCita cita={cita} />
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
