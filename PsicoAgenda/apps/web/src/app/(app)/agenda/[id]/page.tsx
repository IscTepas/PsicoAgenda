import { notFound } from "next/navigation"
import { APP_NAME } from "@psicoagenda/shared"
import { AppointmentForm } from "../components/appointment-form"
import { getAppointmentById } from "@/lib/mock-data"

export const metadata = {
  title: `Gestión de Cita | ${APP_NAME}`,
  description: "Detalles, consulta y modificación de la sesión clínica programada.",
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const appointment = getAppointmentById(id)

  if (!appointment) {
    notFound()
  }

  return <AppointmentForm initialAppointment={appointment} />
}
