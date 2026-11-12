import { Suspense } from "react"
import { ConfiguracionCitas } from "./configuracion-citas"

export const metadata = {
  title: "Configuración de citas",
}

export default function CitasPage() {
  // `useSearchParams` (la pestaña en la URL) exige un límite de Suspense.
  return (
    <Suspense>
      <ConfiguracionCitas />
    </Suspense>
  )
}
