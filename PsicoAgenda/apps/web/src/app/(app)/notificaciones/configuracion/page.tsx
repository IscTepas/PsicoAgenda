import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "../../components/page-header"
import { ReminderConfigForm } from "./reminder-config-form"

export const metadata = {
  title: "Preferencias de Notificaciones",
}

export default function ConfiguracionRecordatoriosPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/notificaciones"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Volver a Notificaciones
      </Link>

      <PageHeader
        title="Preferencias de Notificaciones"
        description="Configura los canales automáticos y el tiempo de anticipación de tus recordatorios de citas."
      />

      <ReminderConfigForm />
    </div>
  )
}
