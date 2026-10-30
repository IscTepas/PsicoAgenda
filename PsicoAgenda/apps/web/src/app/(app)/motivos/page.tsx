import { PageHeader } from "../components/page-header"
import { ReasonCatalogAdmin } from "./reason-catalog-admin"

export const metadata = {
  title: "Motivos de consulta",
}

export default function MotivosConsultaPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Motivos de consulta"
        description="Catálogo que se ofrece al agendar o solicitar una cita. Un motivo en uso no se borra: se desactiva."
      />
      <ReasonCatalogAdmin />
    </div>
  )
}
