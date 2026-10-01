import { APP_NAME } from "@psicoagenda/shared"
import { DashboardView } from "./dashboard-view"

export const metadata = {
  title: `Panel | ${APP_NAME}`,
}

export default function DashboardPage() {
  return <DashboardView />
}
