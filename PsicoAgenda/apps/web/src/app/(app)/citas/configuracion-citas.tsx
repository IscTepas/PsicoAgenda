"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs"
import { PageHeader } from "../components/page-header"
import { CostosCitas } from "./costos-citas"
import { Disponibilidad } from "./disponibilidad"

const SECCIONES = ["disponibilidad", "costos"] as const
type Seccion = (typeof SECCIONES)[number]

/** Cuándo atiende y cuánto cobra la psicóloga, en un solo lugar. La pestaña vive en la URL para poder enlazarla. */
export function ConfiguracionCitas() {
  const router = useRouter()
  const pedida = useSearchParams().get("seccion")
  const seccion: Seccion = SECCIONES.includes(pedida as Seccion) ? (pedida as Seccion) : "disponibilidad"

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Configuración de citas"
        description="Define cuándo atiendes y cuánto cuesta cada sesión."
      />
      <Tabs
        value={seccion}
        onValueChange={(siguiente) =>
          router.replace(siguiente === "disponibilidad" ? "/citas" : `/citas?seccion=${siguiente}`, { scroll: false })
        }
        variant="segment"
        className="space-y-6"
      >
        <TabsList aria-label="Secciones de la configuración de citas" className="bg-muted p-1">
          <TabsTrigger value="disponibilidad" className="px-4 py-1.5 text-sm">
            Disponibilidad
          </TabsTrigger>
          <TabsTrigger value="costos" className="px-4 py-1.5 text-sm">
            Costos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="disponibilidad">
          <Disponibilidad />
        </TabsContent>
        <TabsContent value="costos">
          <CostosCitas />
        </TabsContent>
      </Tabs>
    </div>
  )
}
