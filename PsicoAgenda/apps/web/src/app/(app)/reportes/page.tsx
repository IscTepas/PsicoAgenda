import { APP_NAME } from "@psicoagenda/shared"
import { ReportsClient } from "./reports-client"

export const metadata = {
  title: `Reportes Administrativos | ${APP_NAME}`,
  description: "Análisis administrativo del consultorio, KPIs de asistencia y honorarios de consultas.",
}

export default function ReportsPage() {
  return <ReportsClient />
}
