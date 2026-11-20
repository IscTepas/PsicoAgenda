"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/toast-provider"
import { psychologistService } from "@/services"

/**
 * Datos del establecimiento para la carátula del expediente (NOM-004 5.2):
 * nombre, tipo y domicilio del consultorio. Se guardan aparte del perfil.
 */
export function DatosConsultorio() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: perfil } = useQuery({ queryKey: ["psicologo", "yo"], queryFn: () => psychologistService.getMe() })
  const [borrador, setBorrador] = React.useState<{ name: string; type: string; address: string } | null>(null)
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const valores = borrador ?? {
    name: perfil?.facilityName ?? "",
    type: perfil?.facilityType ?? "Consultorio de psicología",
    address: perfil?.facilityAddress ?? "",
  }
  const cambiar = (campo: keyof typeof valores, v: string) => setBorrador({ ...valores, [campo]: v })

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await psychologistService.updateMe({
        facilityName: valores.name.trim(),
        facilityType: valores.type.trim(),
        facilityAddress: valores.address.trim(),
      })
      queryClient.setQueryData(["psicologo", "yo"], actualizado)
      setBorrador(null)
      toast({ title: "Datos del consultorio guardados", status: "success" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
          Datos del consultorio
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Aparecen en la carátula de cada expediente clínico y al imprimirlo, como pide la NOM-004.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="consultorio-nombre">Nombre del consultorio</Label>
          <Input
            id="consultorio-nombre"
            value={valores.name}
            onChange={(e) => cambiar("name", e.target.value)}
            maxLength={150}
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="consultorio-tipo">Tipo de establecimiento</Label>
          <Input
            id="consultorio-tipo"
            value={valores.type}
            onChange={(e) => cambiar("type", e.target.value)}
            required
            minLength={3}
            maxLength={100}
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="consultorio-domicilio">Domicilio</Label>
          <Input
            id="consultorio-domicilio"
            value={valores.address}
            onChange={(e) => cambiar("address", e.target.value)}
            maxLength={300}
            placeholder="Calle, número, colonia, ciudad y estado"
            className="h-10 rounded-xl"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {borrador && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={guardando} onClick={() => setBorrador(null)}>
            Descartar
          </Button>
          <Button type="submit" disabled={guardando} aria-busy={guardando}>
            {guardando && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </div>
      )}
    </form>
  )
}
