import { redirect } from "next/navigation"

// La sección se mudó a Configuración de citas; los enlaces viejos siguen funcionando.
export default function CostosPage() {
  redirect("/citas?seccion=costos")
}
