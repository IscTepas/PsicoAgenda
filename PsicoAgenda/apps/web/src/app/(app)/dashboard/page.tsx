import Link from "next/link"
import { Plus } from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "../components/page-header"
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  MOCK_PSYCHOLOGIST,
  formatAppointmentTime,
  formatShortDate,
  getPatientById,
} from "@/lib/mock-data"
import { AppointmentStatus } from "@psicoagenda/shared"

export const metadata = {
  title: `Dashboard | ${APP_NAME}`,
}

function statusLabel(status: AppointmentStatus) {
  switch (status) {
    case AppointmentStatus.PENDING:
      return { label: "Pendiente", variant: "secondary" as const }
    case AppointmentStatus.CONFIRMED:
      return { label: "Confirmada", variant: "default" as const }
    case AppointmentStatus.CANCELLED:
      return { label: "Cancelada", variant: "destructive" as const }
    case AppointmentStatus.COMPLETED:
      return { label: "Completada", variant: "outline" as const }
    case AppointmentStatus.NO_SHOW:
      return { label: "No asistió", variant: "outline" as const }
  }
}

export default function DashboardPage() {
  const today = new Date()
  const todayAppointments = MOCK_APPOINTMENTS.filter(
    (apt) =>
      apt.startTime.getDate() === today.getDate() &&
      apt.startTime.getMonth() === today.getMonth() &&
      apt.startTime.getFullYear() === today.getFullYear()
  )
  const upcomingAppointments = MOCK_APPOINTMENTS.filter(
    (apt) => apt.startTime >= today
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${MOCK_PSYCHOLOGIST.name.split(" ")[1] ?? MOCK_PSYCHOLOGIST.name}`}
        description="Resumen de tu práctica clínica"
        actions={
          <Button asChild>
            <Link href="/agenda/nueva">
              <Plus className="mr-2 size-4" />
              Nueva cita
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Citas hoy</CardDescription>
            <CardTitle className="text-3xl">{todayAppointments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pacientes activos</CardDescription>
            <CardTitle className="text-3xl">{MOCK_PATIENTS.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendientes de confirmar</CardDescription>
            <CardTitle className="text-3xl">
              {MOCK_APPOINTMENTS.filter((apt) => apt.status === AppointmentStatus.PENDING).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Notificaciones sin leer</CardDescription>
            <CardTitle className="text-3xl">1</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas citas</CardTitle>
          <CardDescription>Citas programadas para los próximos días</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <p className="text-muted-foreground">No hay citas próximas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingAppointments.map((apt) => {
                  const patient = getPatientById(apt.patientId)
                  const status = statusLabel(apt.status)
                  return (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">
                        {patient?.name ?? "Desconocido"}
                      </TableCell>
                      <TableCell>{formatShortDate(apt.startTime)}</TableCell>
                      <TableCell>{formatAppointmentTime(apt.startTime)}</TableCell>
                      <TableCell className="capitalize">
                        {apt.modality === "in_person" ? "Presencial" : "Virtual"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
