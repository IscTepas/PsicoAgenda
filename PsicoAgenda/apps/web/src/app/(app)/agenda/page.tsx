import Link from "next/link"
import { Plus } from "lucide-react"
import { APP_NAME, AppointmentStatus } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  getPatientById,
  formatAppointmentTime,
  formatShortDate,
} from "@/lib/mock-data"

export const metadata = {
  title: `Agenda | ${APP_NAME}`,
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

export default function AgendaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Consulta y gestiona tus citas programadas"
        actions={
          <Button asChild>
            <Link href="/agenda/nueva">
              <Plus className="mr-2 size-4" />
              Nueva cita
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="semana">
        <TabsList>
          <TabsTrigger value="dia">Día</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mes</TabsTrigger>
        </TabsList>
        <TabsContent value="dia">
          <Card>
            <CardHeader>
              <CardTitle>Vista del día</CardTitle>
              <CardDescription>
                Aquí se mostrará el calendario por día.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Calendario por día</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="semana">
          <Card>
            <CardHeader>
              <CardTitle>Vista de la semana</CardTitle>
              <CardDescription>
                Aquí se mostrará el calendario semanal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Calendario semanal</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mes">
          <Card>
            <CardHeader>
              <CardTitle>Vista del mes</CardTitle>
              <CardDescription>
                Aquí se mostrará el calendario mensual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Calendario mensual</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Próximas citas</CardTitle>
          <CardDescription>Listado de citas próximas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_APPOINTMENTS.map((apt) => {
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
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/pacientes/${apt.patientId}`}>Ver paciente</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
