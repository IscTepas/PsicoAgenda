import { notFound } from "next/navigation"
import { APP_NAME, UserRole } from "@psicoagenda/shared"
import { AppointmentForm } from "../components/appointment-form"
import { getAppointmentById, getPatientForUser } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import { readIdentity } from "@/lib/session"

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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const sessionUser = readIdentity(user)

  // Si es paciente, solo puede ver y gestionar sus propias citas
  if (sessionUser?.role === UserRole.PATIENT) {
    const patient = getPatientForUser(sessionUser)
    if (appointment.patientId !== patient.id) {
      notFound()
    }
  }

  return <AppointmentForm initialAppointment={appointment} />
}
