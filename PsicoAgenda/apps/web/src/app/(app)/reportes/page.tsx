"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AppointmentStatus, AttendanceStatus, type Appointment } from "@psicoagenda/shared"
import { appointmentService, patientService } from "@/services"
import Link from "next/link"
import {
  CalendarDays,
  FileBarChart,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  XCircle,
  RefreshCw,
  TrendingUp,
  DollarSign,
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
import { Table, type TableColumn } from "@/components/motion/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  serviceType: NonNullable<Appointment["sessionType"]>
  reason: string
}

const REPORT_STATUS: Record<ReportAppointment["status"], { label: string; dot: string; order: number }> = {
  attended: { label: "Asistida", dot: "bg-primary", order: 0 },
  pending: { label: "Programada", dot: "bg-amber-500", order: 1 },
  no_show: { label: "Inasistencia", dot: "bg-muted-foreground/50", order: 2 },
  cancelled: { label: "Cancelada", dot: "bg-destructive", order: 3 },
}

const REPORT_ROW_HEIGHT = 56

const SERVICE_TYPE_LABELS: Record<ReportAppointment["serviceType"], string> = {
  initial: "Consulta inicial",
  individual: "Terapia individual",
  couple: "Terapia de pareja",
  family: "Terapia familiar",
}

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
    serviceType: apt.sessionType ?? "individual",
    reason: apt.reason || "Sin motivo registrado",
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
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
  const [serviceTypeFilter, setServiceTypeFilter] = useState<"all" | ReportAppointment["serviceType"]>("all")

  // Estado aplicado (se confirma al hacer clic en "Generar Reporte")
  const [appliedFilters, setAppliedFilters] = useState({
    fromDate: defaultRange.from,
    toDate: defaultRange.to ?? defaultRange.from,
    status: "all" as "all" | ReportAppointment["status"],
    serviceType: "all" as "all" | ReportAppointment["serviceType"],
  })

  const [notification, setNotification] = useState<string | null>(null)

  // Datos reales: citas del período aplicado y nombres de los pacientes.
  const appointmentsQuery = useQuery({
    queryKey: ["reports", "appointments", appliedFilters.fromDate, appliedFilters.toDate],
    queryFn: () =>
      appointmentService.list({
        from: new Date(`${appliedFilters.fromDate}T00:00:00`),
        to: new Date(`${appliedFilters.toDate}T23:59:59.999`),
        limit: 200,
      }),
  })
  const { data: patients = [] } = useQuery({
    queryKey: ["patients", "list", 100],
    queryFn: () => patientService.list({ limit: 100 }),
    staleTime: 60_000,
  })
  const isGenerating = appointmentsQuery.isFetching
  const records = useMemo(() => {
    const names = new Map(patients.map((p) => [p.id, p.name]))
    return (appointmentsQuery.data ?? []).map((apt) => toReportRow(apt, names.get(apt.patientId) ?? "Paciente"))
  }, [appointmentsQuery.data, patients])

  // El selector de rango no deja el fin antes del inicio; solo falta avisar si quedó a medias.
  const rangeError = fromDate && !toDate ? "Elige también la fecha final del período." : null
  const presets = useMemo(() => reportPresets(), [])

  // Ejecución de filtro
  const handleGenerateReport = () => {
    if (rangeError) return
    setAppliedFilters({
      fromDate,
      toDate,
      status: statusFilter,
      serviceType: serviceTypeFilter,
    })
    // Mismo período: se vuelve a pedir a la API para reflejar cambios recientes.
    if (fromDate === appliedFilters.fromDate && toDate === appliedFilters.toDate) void appointmentsQuery.refetch()
    setNotification("Reporte generado con los criterios seleccionados.")
    setTimeout(() => setNotification(null), 3000)
  }

  // Filtrado reactivo de registros
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      // Filtro de fecha
      if (appliedFilters.fromDate && item.date < appliedFilters.fromDate) return false
      if (appliedFilters.toDate && item.date > appliedFilters.toDate) return false

      // Filtro de estado
      if (appliedFilters.status !== "all" && item.status !== appliedFilters.status) return false

      // Filtro de tipo de servicio
      if (appliedFilters.serviceType !== "all" && item.serviceType !== appliedFilters.serviceType) return false

      return true
    })
  }, [appliedFilters, records])

  // Cálculo de KPIs
  const totalConsultations = filteredRecords.length
  const totalAttended = filteredRecords.filter((r) => r.status === "attended").length
  const totalCancelled = filteredRecords.filter(
    (r) => r.status === "cancelled" || r.status === "no_show",
  ).length
  const attendanceRate =
    totalConsultations > 0
      ? Math.round((totalAttended / totalConsultations) * 100 * 10) / 10
      : 0
  const totalFees = filteredRecords.reduce((acc, curr) => acc + curr.fee, 0)

  // Exportar a Excel (CSV real)
  const handleExportCSV = () => {
    const headers = ["Fecha", "Hora", "Paciente", "Estado", "Tipo de Servicio", "Modalidad", "Motivo", "Honorario (MXN)"]
    const rows = filteredRecords.map((r) => [
      r.date,
      r.time,
      `"${r.patientName}"`,
      statusLabel(r.status),
      SERVICE_TYPE_LABELS[r.serviceType],
      r.modality === "in_person" ? "Presencial" : "Virtual",
      `"${r.reason}"`,
      r.fee.toFixed(2),
    ])

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute(
      "download",
      `reporte_consultorio_${appliedFilters.fromDate}_a_${appliedFilters.toDate}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setNotification("Reporte exportado exitosamente en formato CSV / Excel.")
    setTimeout(() => setNotification(null), 3500)
  }

  // Exportar a PDF (simulación y aviso)
  const handleExportPDF = () => {
    window.print()
    setNotification("Vista de impresión / PDF generada.")
    setTimeout(() => setNotification(null), 3500)
  }

  const reportColumns: TableColumn<ReportAppointment>[] = [
    {
      key: "date",
      header: "Fecha",
      sortable: true,
      width: "170px",
      sortValue: (item) => `${item.date} ${item.time}`,
      cell: (item) => (
        <div className="flex flex-col text-xs tabular-nums">
          <span className="font-medium text-foreground">{formatDate(item.date)}</span>
          <span className="text-[11px] text-muted-foreground">
            {item.time} hrs · {item.modality === "in_person" ? "Presencial" : "Virtual"}
          </span>
        </div>
      ),
    },
    {
      key: "patientName",
      header: "Paciente",
      sortable: true,
      width: "32%",
      sortValue: (item) => item.patientName.toLocaleLowerCase("es"),
      cell: (item) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar size="sm" className="size-7 shrink-0 border border-border/40">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(item.patientName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              href={`/pacientes/${item.patientId}`}
              className="block truncate text-xs font-semibold text-foreground transition-colors hover:text-primary hover:underline"
            >
              {item.patientName}
            </Link>
            <span className="block truncate text-[11px] text-muted-foreground">{item.reason}</span>
          </div>
        </div>
      ),
    },
    {
      key: "serviceType",
      header: "Servicio",
      sortable: true,
      sortValue: (item) => SERVICE_TYPE_LABELS[item.serviceType],
      cell: (item) => <span className="text-xs text-foreground">{SERVICE_TYPE_LABELS[item.serviceType]}</span>,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      width: "130px",
      sortValue: (item) => REPORT_STATUS[item.status].order,
      cell: (item) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
          <span className={`size-1.5 rounded-full ${REPORT_STATUS[item.status].dot}`} aria-hidden="true" />
          {REPORT_STATUS[item.status].label}
        </span>
      ),
    },
    {
      key: "fee",
      header: "Honorario",
      sortable: true,
      align: "right",
      width: "120px",
      sortValue: (item) => item.fee,
      cell: (item) => (
        <span className={`text-xs tabular-nums ${item.fee > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {formatCurrency(item.fee)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* CABECERA CON ACCIÓN PRINCIPAL SUPERIOR DERECHA */}
      <PageHeader
        title="Reportes de Práctica Clínica"
        description={`Análisis administrativo y financiero • Período: ${formatDate(
          appliedFilters.fromDate
        )} al ${formatDate(appliedFilters.toDate)}`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all gap-1.5 h-9 px-3.5">
                <Download className="size-3.5" />
                <span>Exportar Reporte</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-md">
              <DropdownMenuItem
                onClick={handleExportPDF}
                className="rounded-lg text-xs font-medium cursor-pointer gap-2 py-2"
              >
                <FileText className="size-4 text-primary" />
                <span>Descargar en PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportCSV}
                className="rounded-lg text-xs font-medium cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="size-4 text-primary" />
                <span>Exportar a Excel (.CSV)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* FEEDBACK TEMPORAL DE ACCIÓN */}
      {notification && (
        <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-xs text-foreground shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-primary" />
            <span className="font-medium">{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground p-1"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* BARRA DE FILTROS REQUERIDA */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-xs transition-all">
        <div className="flex items-center gap-2 mb-3.5">
          <Filter className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Barra de Filtros
          </h2>
          <span className="text-xs text-muted-foreground/80">• Personaliza el período y criterio</span>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-end">
          {/* Período: un solo selector de rango (desde – hasta) con atajos */}
          <div className="relative space-y-1.5 sm:col-span-2">
            <span id="report-range-label" className="block text-xs font-medium text-foreground">
              Período
            </span>
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
              // El contenedor del componente es inline: se fuerza a ocupar toda la columna.
              className="flex w-full"
              triggerClassName="h-9 w-full justify-between rounded-xl border-border/60 bg-background text-xs"
            />
            {rangeError && (
              <p role="alert" className="absolute inset-x-0 top-full mt-1 text-[11px] leading-snug text-destructive">
                {rangeError}
              </p>
            )}
          </div>

          {/* Selector Estado de Cita */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Estado de la Cita
            </label>
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
            >
              <SelectTrigger className="w-full rounded-xl border-border/60 text-xs h-9 bg-background focus:ring-primary/40">
                <SelectValue placeholder="Estado de cita" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">
                  Todas las citas
                </SelectItem>
                <SelectItem value="attended" className="text-xs">
                  Asistidas
                </SelectItem>
                <SelectItem value="pending" className="text-xs">
                  Programadas
                </SelectItem>
                <SelectItem value="cancelled" className="text-xs">
                  Canceladas
                </SelectItem>
                <SelectItem value="no_show" className="text-xs">
                  Inasistencias
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selector Tipo de Servicio */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Tipo de Servicio
            </label>
            <Select
              value={serviceTypeFilter}
              onValueChange={(val) => setServiceTypeFilter(val as typeof serviceTypeFilter)}
            >
              <SelectTrigger className="w-full rounded-xl border-border/60 text-xs h-9 bg-background focus:ring-primary/40">
                <SelectValue placeholder="Tipo de servicio" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">
                  Todos los servicios
                </SelectItem>
                {(Object.keys(SERVICE_TYPE_LABELS) as Array<ReportAppointment["serviceType"]>).map(
                  (key) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {SERVICE_TYPE_LABELS[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Botón: Generar Reporte */}
          <div>
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating || Boolean(rangeError)}
              className="w-full rounded-xl bg-primary text-primary-foreground text-xs font-medium h-9 shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              <span>{isGenerating ? "Calculando..." : "Generar Reporte"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN (KPIS REQUERIDOS CON NÚMEROS GRANDES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total de Consultas */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 transition-all shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-muted-foreground">
              Total de consultas
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-[32px] font-bold tracking-[-0.03em] tabular-nums text-foreground leading-none">
            {totalConsultations}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            Consultas registradas en el rango
          </p>
        </div>

        {/* KPI 2: Tasa de Asistencia */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 transition-all shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-muted-foreground">
              Tasa de Asistencia
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-[32px] font-bold tracking-[-0.03em] tabular-nums text-foreground leading-none">
            {attendanceRate}%
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            {totalAttended} de {totalConsultations} citas asistidas
          </p>
        </div>

        {/* KPI 3: Total Canceladas */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 transition-all shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-muted-foreground">
              Total Canceladas
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[32px] font-bold tracking-[-0.03em] tabular-nums text-foreground leading-none">
              {totalCancelled}
            </span>
            {totalCancelled > 0 && (
              <span className="rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-medium px-2 py-0.5">
                {Math.round((totalCancelled / (totalConsultations || 1)) * 100)}%
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            Cancelaciones o inasistencias
          </p>
        </div>

        {/* KPI 4 (Complementario de valor): Total Honorarios */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 transition-all shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-muted-foreground">
              Total Honorarios
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-[26px] font-bold tracking-[-0.03em] tabular-nums text-foreground leading-none">
            {formatCurrency(totalFees)}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            Ingresos generados en el período
          </p>
        </div>
      </div>

      {/* TABLA DE RESULTADOS REQUERIDA */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/10">
          <div>
            <h3 className="text-base font-semibold tracking-[-0.015em] text-foreground">
              Tabla de Resultados
            </h3>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Desglose detallado de consultas filtradas ({filteredRecords.length} registros)
            </p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            Mostrando {filteredRecords.length} de {records.length} citas
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <FileBarChart className="size-8 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No se encontraron consultas para este criterio</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Prueba ampliando el rango de fechas o seleccionando &ldquo;Todas las citas&rdquo; en el estado.
            </p>
          </div>
        ) : (
          // Misma tabla que Pacientes: ordena por encabezado, ancho ajustable y crece con sus filas.
          <Table
            data={filteredRecords}
            columns={reportColumns}
            getRowId={(item) => item.id}
            defaultSort={{ key: "date", direction: "desc" }}
            resizable
            rowHeight={REPORT_ROW_HEIGHT}
            height="auto"
            overscan={filteredRecords.length}
            className="rounded-none border-0 bg-card"
          />
        )}

        {/* PIE DE TABLA CON TOTALES ACUMULADOS */}
        {filteredRecords.length > 0 && (
          <div className="px-5 py-3.5 border-t border-border/40 bg-muted/15 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Total acumulado en el período:{" "}
              <strong className="text-foreground font-semibold">
                {totalConsultations} consultas
              </strong>{" "}
              ({totalAttended} asistidas, {totalCancelled} canceladas)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Suma de Honorarios:</span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(totalFees)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

