import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, FileText } from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "../../components/page-header"
import {
  getAppointmentsByPatientId,
  getPatientById,
  MOCK_CLINICAL_RECORD,
  formatAppointmentTime,
  formatShortDate,
} from "@/lib/mock-data"

export const metadata = {
  title: `Detalle del paciente | ${APP_NAME}`,
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = getPatientById(id)

  if (!patient) {
    notFound()
  }

  const appointments = getAppointmentsByPatientId(id)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/pacientes">
          <ArrowLeft className="mr-2 size-4" />
          Volver a pacientes
        </Link>
      </Button>

      <PageHeader
        title={patient.name}
        description={patient.email}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/agenda/nueva?patientId=${patient.id}`}>
                <CalendarDays className="mr-2 size-4" />
                Nueva cita
              </Link>
            </Button>
            <Button disabled>Editar</Button>
          </>
        }
      />

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos personales</TabsTrigger>
          <TabsTrigger value="citas">Citas</TabsTrigger>
          <TabsTrigger value="expediente">Expediente</TabsTrigger>
          <TabsTrigger value="consentimiento">Consentimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información general</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p>{patient.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Correo</p>
                <p>{patient.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Género</p>
                <p className="capitalize">{patient.gender ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dirección</p>
                <p>{patient.address ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Menor de edad</p>
                {patient.isMinor ? (
                  <Badge variant="secondary">Sí</Badge>
                ) : (
                  <Badge variant="outline">No</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {patient.emergencyContact ? (
            <Card>
              <CardHeader>
                <CardTitle>Contacto de emergencia</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p>{patient.emergencyContact.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p>{patient.emergencyContact.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parentesco</p>
                  <p>{patient.emergencyContact.relationship ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {patient.legalGuardian ? (
            <Card>
              <CardHeader>
                <CardTitle>Tutor legal</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p>{patient.legalGuardian.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p>{patient.legalGuardian.documentId ?? "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relación</p>
                  <p>{patient.legalGuardian.relationship ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="citas" className="space-y-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay citas registradas.
              </CardContent>
            </Card>
          ) : (
            appointments.map((apt) => (
              <Card key={apt.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {formatShortDate(apt.startTime)} ·{" "}
                    {formatAppointmentTime(apt.startTime)}
                  </CardTitle>
                  <CardDescription className="capitalize">
                    {apt.modality === "in_person" ? "Presencial" : "Virtual"} ·{" "}
                    {apt.status}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Motivo: {apt.reason ?? "—"}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="expediente" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                Expediente clínico
              </CardTitle>
              <CardDescription>
                Última actualización: {formatShortDate(MOCK_CLINICAL_RECORD.updatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Diagnóstico</p>
                <p>{MOCK_CLINICAL_RECORD.diagnosis}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Antecedentes</p>
                <p>{MOCK_CLINICAL_RECORD.background}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Observaciones generales</p>
                <p>{MOCK_CLINICAL_RECORD.generalObservations}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consentimiento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consentimiento informado</CardTitle>
              <CardDescription>
                Documento de consentimiento y firma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Aquí se mostrará el estado del consentimiento informado del paciente.
              </p>
              <Button disabled className="mt-4">
                Subir documento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
