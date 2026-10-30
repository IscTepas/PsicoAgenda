"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { UserRole, type ConsultationReason } from "@psicoagenda/shared"
import { Plus, Trash2 } from "lucide-react"
import { useSession } from "@/lib/use-session"
import { useToast } from "@/components/toast-provider"
import { consultationReasonService } from "@/services"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

const VACIO = { code: "", label: "", category: "" }

/** CRUD mínimo del catálogo; la API exige el rol administrador en cada operación. */
export function ReasonCatalogAdmin() {
  const { user } = useSession()
  const isAdmin = user?.role === UserRole.ADMIN
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [draft, setDraft] = useState(VACIO)
  const [error, setError] = useState<string | null>(null)

  const { data: reasons = [], isLoading } = useQuery({
    queryKey: ["motivos-consulta", "todos"],
    queryFn: consultationReasonService.listAll,
    enabled: isAdmin,
  })

  if (!user) return null
  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertDescription>Esta sección es solo para administración.</AlertDescription>
      </Alert>
    )
  }

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["motivos-consulta"] })

  async function ejecutar(accion: () => Promise<unknown>, exito: string) {
    setError(null)
    try {
      await accion()
      toast({ title: exito, status: "success" })
      await refrescar()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.")
    }
  }

  const crear = (event: React.FormEvent) => {
    event.preventDefault()
    const esOtro = draft.code.trim() === "otro"
    void ejecutar(async () => {
      await consultationReasonService.create({ ...draft, isOther: esOtro })
      setDraft(VACIO)
    }, "Motivo agregado")
  }

  const editar = (reason: ConsultationReason, patch: Partial<ConsultationReason>) =>
    ejecutar(() => consultationReasonService.update(reason.id, patch), "Motivo actualizado")

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <form onSubmit={crear} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Input
              aria-label="Código"
              placeholder="codigo_unico"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              required
            />
            <Input
              aria-label="Etiqueta"
              placeholder="Etiqueta visible"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              required
            />
            <Input
              aria-label="Categoría"
              placeholder="Categoría"
              list="categorias-motivo"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              required
            />
            <datalist id="categorias-motivo">
              {[...new Set(reasons.map((r) => r.category))].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Button type="submit">
              <Plus /> Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="divide-y divide-border p-0">
          {isLoading ? <p className="p-4 text-sm text-muted-foreground">Cargando…</p> : null}
          {reasons.map((reason) => (
            <div key={reason.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${reason.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {reason.label}
                  {reason.isOther ? <span className="ml-2 text-xs text-muted-foreground">(pide texto)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reason.category} · <code>{reason.code}</code>
                </p>
              </div>
              <Input
                aria-label={`Orden de ${reason.label}`}
                type="number"
                className="h-8 w-20"
                defaultValue={reason.order}
                onBlur={(e) => {
                  const orden = Number(e.target.value)
                  if (orden !== reason.order) void editar(reason, { order: orden })
                }}
              />
              <Switch
                checked={reason.active}
                onCheckedChange={(active) => void editar(reason, { active })}
                aria-label={`${reason.active ? "Desactivar" : "Activar"} ${reason.label}`}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Borrar ${reason.label}`}
                onClick={() => void ejecutar(() => consultationReasonService.remove(reason.id), "Motivo borrado")}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
