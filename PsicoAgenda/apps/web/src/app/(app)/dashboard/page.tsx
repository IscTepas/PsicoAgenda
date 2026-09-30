import Link from "next/link"
import { Plus, Calendar } from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { PageHeader } from "../components/page-header"
import { MOCK_PSYCHOLOGIST } from "@/lib/mock-data"
import { DashboardView } from "./dashboard-view"

export const metadata = {
  title: `Panel Clínico | ${APP_NAME}`,
}

export default function DashboardPage() {
  const firstName = MOCK_PSYCHOLOGIST.name.split(" ")[1] ?? MOCK_PSYCHOLOGIST.name

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bienvenida, Dra. ${firstName}`}
        description="Gestión del día clínico • Consultas inmediatas, agenda y expedientes"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="hidden sm:inline-flex">
              <Link href="/agenda">
                <Calendar className="mr-1.5 size-4" />
                Ver agenda
              </Link>
            </Button>
            <Button asChild className="shadow-xs font-medium">
              <Link href="/agenda/nueva">
                <Plus className="mr-1.5 size-4" />
                Nueva cita
              </Link>
            </Button>
          </div>
        }
      />

      <DashboardView />
    </div>
  )
}
