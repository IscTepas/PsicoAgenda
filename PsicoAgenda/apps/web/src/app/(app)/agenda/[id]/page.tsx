import { notFound } from "next/navigation"
import { APP_NAME } from "@psicoagenda/shared"
import { AppointmentForm } from "../components/appointment-form"
import { appointmentService } from "@/services"
import { ApiError } from "@/lib/api-client"
import { getServerAccessToken } from "@/lib/api-client.server"

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
  const token = await getServerAccessToken()

  let appointment
  try {
    appointment = await appointmentService.get(id, token ?? undefined)
  } catch (error) {
    // La API es la autoridad: 404 si no existe y 403 si es de otro paciente o
    // profesional. En ambos casos la cita no debe mostrarse.
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      notFound()
    }
    throw error
  }

  return <AppointmentForm initialAppointment={appointment} />
}
