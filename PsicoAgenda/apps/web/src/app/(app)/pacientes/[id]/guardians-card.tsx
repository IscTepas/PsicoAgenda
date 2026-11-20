"use client"

import { useState } from "react"
import type { LegalGuardian } from "@psicoagenda/shared"
import { Crown, ShieldCheck, UserPlus } from "lucide-react"
import { guardianService } from "@/services/patient.service"
import { useToast } from "@/components/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Tutores de un menor: enlazar una cuenta por correo o registrar un contacto,
 * y elegir el principal. Solo se monta para pacientes menores: a un
 * adulto no se le ofrece vincular tutores.
 */
export function GuardiansCard({ patientId, initial }: { patientId: string; initial: LegalGuardian[] }) {
  const [guardians, setGuardians] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ email: "", name: "", phone: "", relationship: "" })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  async function run(action: () => Promise<LegalGuardian[]>, done: string) {
    setBusy(true)
    setError(null)
    try {
      setGuardians(await action())
      toast({ title: done, status: "success" })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    const payload = draft.email.trim()
      ? { email: draft.email.trim(), relationship: draft.relationship || undefined }
      : {
          name: draft.name.trim(),
          phone: draft.phone || undefined,
          relationship: draft.relationship || undefined,
        }
    if (await run(() => guardianService.add(patientId, payload), "Tutor vinculado")) {
      setDraft({ email: "", name: "", phone: "", relationship: "" })
      setAdding(false)
    }
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/[0.03] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ShieldCheck className="size-3.5" />
          <span>Tutores</span>
        </div>
        {/* Con tutor ya vinculado (desde el registro o por el propio tutor) no hay nada que vincular. */}
        {!adding && guardians.length === 0 ? (
          <Button size="sm" variant="ghost" className="h-10 text-xs sm:h-8" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" /> Vincular
          </Button>
        ) : null}
      </div>

      {guardians.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin tutor registrado.</p>
      ) : (
        <ul className="space-y-2">
          {guardians.map((guardian) => (
            <li key={guardian.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {guardian.name}
                  {guardian.relationship ? (
                    <span className="text-xs font-normal text-muted-foreground"> ({guardian.relationship})</span>
                  ) : null}
                  {guardian.isPrimary ? (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Principal
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {guardian.hasAccount ? guardian.email : "Sin cuenta"} · Tel: {guardian.phone || "—"}
                </p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                {!guardian.isPrimary ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10 sm:size-8"
                    disabled={busy}
                    aria-label={`Hacer principal a ${guardian.name}`}
                    onClick={() => void run(() => guardianService.setPrimary(patientId, guardian.id), "Tutor principal actualizado")}
                  >
                    <Crown className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={add} className="space-y-2 border-t border-border/60 pt-2.5">
          <Input
            type="email"
            aria-label="Correo de la cuenta del tutor"
            placeholder="Correo de su cuenta (si tiene)"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className="h-10 text-xs sm:h-8"
          />
          {!draft.email.trim() ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label="Nombre del tutor"
                placeholder="Nombre completo"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-10 text-xs sm:h-8"
                required
              />
              <Input
                aria-label="Teléfono del tutor"
                placeholder="Teléfono"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="h-10 text-xs sm:h-8"
              />
            </div>
          ) : null}
          <Input
            aria-label="Parentesco"
            placeholder="Parentesco (Madre, Padre…)"
            value={draft.relationship}
            onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
            className="h-10 text-xs sm:h-8"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" className="h-10 text-xs sm:h-8" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="h-10 text-xs sm:h-8" disabled={busy}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
