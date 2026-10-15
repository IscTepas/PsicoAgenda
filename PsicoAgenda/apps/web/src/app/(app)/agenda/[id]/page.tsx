import { notFound } from "next/navigation"
import { APP_NAME, type Appointment } from "@psicoagenda/shared"
import { AppointmentForm } from "../components/appointment-form"
import { apiFetchServer } from "@/lib/api-client-server"
import { ApiError } from "@/lib/api-client"

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

  let appointment: Appointment
  try {
    appointment = await apiFetchServer<Appointment>(`/appointments/${id}`)
  } catch (error) {
    // Si la cita no existe o el usuario no tiene permiso, se trata como 404.
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound()
    }
    throw error
  }

  return <AppointmentForm initialAppointment={appointment} />
}
