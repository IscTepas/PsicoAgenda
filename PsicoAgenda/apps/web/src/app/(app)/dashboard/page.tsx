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
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              asChild
              className="hidden sm:inline-flex rounded-xl border-border/60 text-xs font-medium hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
              <Link href="/agenda">
                <Calendar className="mr-1.5 size-3.5" />
                Ver agenda
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-xl bg-primary text-primary-foreground shadow-xs font-medium text-xs hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              <Link href="/agenda/nueva">
                <Plus className="mr-1.5 size-3.5" />
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
