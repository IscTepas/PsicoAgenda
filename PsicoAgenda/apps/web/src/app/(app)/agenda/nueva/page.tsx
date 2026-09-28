import { APP_NAME } from "@psicoagenda/shared"
import { NewAppointmentForm } from "./new-appointment-form"

export const metadata = {
  title: `Nueva cita | ${APP_NAME}`,
}

export default function NewAppointmentPage() {
  return <NewAppointmentForm />
}
