import { APP_NAME } from "@psicoagenda/shared"
import { AgendaClient } from "./agenda-client"

export const metadata = {
  title: `Agenda Digital | ${APP_NAME}`,
  description: "Calendario interactivo y gestión clínica de citas para profesionales y pacientes.",
}

export default function AgendaPage() {
  return <AgendaClient />
}
