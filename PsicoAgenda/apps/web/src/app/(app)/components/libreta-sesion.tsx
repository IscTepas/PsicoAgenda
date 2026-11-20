"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Check, Loader2, Pencil, Plus, X } from "lucide-react"
import { ConsentStatus, type SessionLogEntry, type SessionTask } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/toast-provider"
import { borrarBorrador, claveDeBorrador, guardarBorrador, leerBorrador } from "@/lib/borradores-bitacora"
import { cn } from "@/lib/utils"
import { clinicalRecordService, logEntryService } from "@/services"

/** Renglones de libreta: una raya cada 32px que se mueve con el texto. */
const RENGLONES: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--border) 31px 32px)",
  backgroundAttachment: "local",
  lineHeight: "32px",
}

const fechaDeHoja = (date: Date) => {
  const dia = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const hora = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora}`
}

/** La hoja crece renglón a renglón con el texto, sin barra propia. */
function crecer(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}

/** Las hojas anteriores guardaban técnicas y acuerdos aparte: ahora todo es una sola hoja. */
function textoDeHoja(entry: SessionLogEntry): string {
  return [
    entry.referredTo && `Se refiere a: ${entry.referredTo}`,
    entry.referralReason && `Motivo de la referencia: ${entry.referralReason}`,
    entry.dischargeReason && `Motivo del egreso: ${entry.dischargeReason}`,
    entry.notes,
    entry.dischargeSummary && `Resumen del tratamiento: ${entry.dischargeSummary}`,
    entry.interventions && `Intervenciones: ${entry.interventions}`,
    entry.homework && `Acuerdos: ${entry.homework}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

/** Hoja con margen y renglones; la comparten la vista de lectura y la de escritura. */
function Hoja({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <article className="overflow-hidden rounded-[18px] border border-border bg-card shadow-2xs">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 sm:pl-14">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {accion}
      </header>
      {/* Márgenes de la libreta: raya teal a la izquierda y aire a la derecha; el texto no los cruza. */}
      <div className="ml-6 min-w-0 border-l-2 border-primary/25 py-4 pl-4 pr-6 sm:ml-10 sm:pr-10">{children}</div>
    </article>
  )
}

function ListaDeTareas({ tasks }: { tasks: SessionTask[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Tarea para casa</p>
      <ul className="mt-2 space-y-1.5">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                task.doneAt ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
              aria-hidden="true"
            >
              {task.doneAt && <Check className="size-3" />}
            </span>
            <span className={cn("min-w-0 break-words", task.doneAt && "text-muted-foreground line-through")}>
              {task.text}
              <span className="sr-only">{task.doneAt ? " (hecha)" : " (pendiente)"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TITULO_DE_NOTA: Partial<Record<SessionLogEntry["kind"], string>> = {
  referral: "Interconsulta / referencia",
  discharge: "Egreso / alta terapéutica",
  clarification: "Nota aclaratoria",
}

/**
 * Una hoja ya escrita, para leerla en el expediente. `onEdit` solo se pasa en
 * borradores; `acciones` reemplaza el botón (cerrar, aclarar…).
 */
export function HojaDeSesion({
  entry,
  onEdit,
  acciones,
  children,
}: {
  entry: SessionLogEntry
  onEdit?: () => void
  acciones?: React.ReactNode
  children?: React.ReactNode
}) {
  const tipo = TITULO_DE_NOTA[entry.kind]
  return (
    <Hoja
      titulo={tipo ? `${tipo} · ${fechaDeHoja(entry.date)}` : fechaDeHoja(entry.date)}
      accion={
        acciones ??
        (onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground">
            <Pencil />
            Editar
          </Button>
        ))
      }
    >
      <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]" style={RENGLONES}>
        {textoDeHoja(entry)}
      </p>
      <ListaDeTareas tasks={entry.tasks ?? []} />
      {children}
    </Hoja>
  )
}

interface TareaEnEdicion {
  id?: string
  key: string
  text: string
  doneAt?: Date
}

export interface LibretaSesionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName?: string
  /** Cita a la que pertenece la hoja; sin cita es una nota suelta con fecha de hoy. */
  appointmentId?: string
  sessionDate: Date
  /** La hoja si ya se conoce; `undefined` la busca por la cita, `null` empieza en blanco. */
  entry?: SessionLogEntry | null
  /** Para retomar una hoja ya guardada de la que solo se conoce el id (borradores). */
  entryId?: string
  onSaved?: (entry: SessionLogEntry, created: boolean) => void
  /** Una línea arriba de la hoja (p. ej. "Sesión cerrada: escribe la nota…"). */
  aviso?: string
}

/**
 * La libreta de una sesión: una hoja libre para escribir y la tarea que se lleva
 * el paciente. Se abre encima de donde esté la psicóloga, sin cambiar de pantalla.
 * Quien la usa debe montarla con `key` por sesión para que el borrador no se mezcle.
 */
export function LibretaSesionDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  appointmentId,
  sessionDate,
  entry: entryProp,
  entryId,
  onSaved,
  aviso,
}: LibretaSesionDialogProps) {
  const { toast } = useToast()
  const clave = claveDeBorrador(patientId, appointmentId, entryProp?.id ?? entryId)
  // Lo que quedó a medias la vez anterior (la libreta solo se monta en el navegador, ya abierta).
  const [borrador] = React.useState(() => leerBorrador(clave))
  const [entry, setEntry] = React.useState<SessionLogEntry | null | undefined>(entryProp)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState(borrador?.notes ?? (entryProp ? textoDeHoja(entryProp) : ""))
  const [tasks, setTasks] = React.useState<TareaEnEdicion[]>(
    () => borrador?.tasks ?? (entryProp?.tasks ?? []).map((t) => ({ ...t, key: t.id })),
  )
  const [nueva, setNueva] = React.useState(borrador?.nueva ?? "")
  const [dirty, setDirty] = React.useState(Boolean(borrador))

  // Cada cambio se guarda como borrador en este navegador: cerrar no pierde nada.
  // Las dependencias son valores, no objetos: un `Date` nuevo por render volvería a guardar sin fin.
  const fechaIso = (entry?.date ?? sessionDate).toISOString()
  const entradaId = entry?.id
  React.useEffect(() => {
    if (!dirty) return
    guardarBorrador({
      clave,
      patientId,
      patientName,
      appointmentId,
      entryId: entradaId,
      sessionDate: fechaIso,
      notes,
      tasks: tasks.map(({ id, key, text }) => ({ id, key, text })),
      nueva,
    })
  }, [dirty, clave, patientId, patientName, appointmentId, entradaId, fechaIso, notes, tasks, nueva])
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const nuevaRef = React.useRef<HTMLInputElement>(null)

  // Regla de la NOM-004: una nota de evolución nueva exige consentimiento vigente e historia clínica cerrada.
  const { data: expediente } = useQuery({
    queryKey: ["expediente", patientId],
    queryFn: () => clinicalRecordService.get(patientId),
    enabled: open && entry === null,
  })
  const faltan =
    entry === null && expediente
      ? [
          !expediente.consents.some((c) => c.status === ConsentStatus.SIGNED) && "el consentimiento informado firmado",
          expediente.historyStatus !== "closed" && "la historia clínica cerrada",
        ].filter((x): x is string => Boolean(x))
      : []

  // Si no se sabe si la sesión ya tiene hoja, se busca al abrir para retomarla.
  React.useEffect(() => {
    if (!open || entry !== undefined) return
    let cancelled = false
    logEntryService.list(patientId).then(
      (rows) => {
        if (cancelled) return
        const previa = rows.find((row) => (entryId ? row.id === entryId : row.appointmentId === appointmentId)) ?? null
        setEntry(previa)
        // Con borrador se respeta lo que estaba a medias; sin él, lo ya guardado.
        if (previa && !borrador) {
          setNotes(textoDeHoja(previa))
          setTasks(previa.tasks.map((t) => ({ ...t, key: t.id })))
        }
      },
      (err) => !cancelled && setLoadError(err instanceof Error ? err.message : "No se pudo abrir la bitácora."),
    )
    return () => {
      cancelled = true
    }
  }, [open, entry, patientId, appointmentId, entryId, borrador])

  const agregarTarea = () => {
    const text = nueva.trim()
    if (!text) return
    setTasks((prev) => [...prev, { key: crypto.randomUUID(), text }])
    setNueva("")
    setDirty(true)
    nuevaRef.current?.focus()
  }

  const cerrar = (next: boolean) => {
    if (isSaving) return
    if (!next && dirty) {
      toast({
        title: "La hoja quedó como borrador",
        description: "No se perdió nada. Te lo recordamos en tu inicio para que la guardes.",
        status: "info",
      })
    }
    onOpenChange(next)
  }

  const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Una tarea escrita pero sin "Agregar" también cuenta.
    const pendiente = nueva.trim()
    const lista = [...tasks, ...(pendiente ? [{ key: "nueva", text: pendiente } as TareaEnEdicion] : [])]
      .map(({ id, text }) => ({ id, text: text.trim() }))
      .filter((t) => t.text !== "")
    if (!notes.trim()) {
      setError("Escribe algo en la hoja antes de guardar.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const saved = entry
        ? // Las hojas viejas se unen en una sola: los campos aparte quedan vacíos.
          await logEntryService.update(entry.id, { notes, interventions: "", homework: "", tasks: lista })
        : await logEntryService.create(patientId, { appointmentId, notes, tasks: lista })
      const nuevas = lista.filter((t) => !t.id).length
      toast({
        title: "Hoja guardada",
        description:
          nuevas > 0
            ? `Se avisó ${patientName ? `a ${patientName}` : "al paciente"} de ${nuevas === 1 ? "su tarea nueva" : `sus ${nuevas} tareas nuevas`}.`
            : undefined,
        status: "success",
      })
      borrarBorrador(clave)
      onSaved?.(saved, !entry)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la hoja.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-h-[92dvh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Bitácora{patientName ? ` de ${patientName}` : ""}
          </DialogTitle>
          <DialogDescription>Una hoja por sesión. Solo tú ves lo que escribes; el paciente solo ve su tarea.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        ) : entry?.status === "closed" ? (
          <p role="status" className="rounded-[14px] bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Esta nota ya está cerrada y sellada:</span> no se modifica. Para
            corregir algo, agrega una nota aclaratoria desde el{" "}
            <Link href={`/pacientes/${patientId}`} className="font-medium text-primary hover:underline">
              expediente
            </Link>
            .
          </p>
        ) : faltan.length > 0 ? (
          <p role="status" className="rounded-[14px] bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Antes de escribir notas de evolución falta {faltan.join(" y ")}.</span>{" "}
            En la primera sesión se firma el consentimiento y se llena la historia clínica, en el{" "}
            <Link href={`/pacientes/${patientId}`} className="font-medium text-primary hover:underline">
              expediente
            </Link>
            .
          </p>
        ) : entry === undefined || (entry === null && !expediente) ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Abriendo la hoja de esta sesión…
          </p>
        ) : (
          <form onSubmit={guardar} className="space-y-4">
            {aviso && !borrador && (
              <p role="status" className="rounded-[14px] bg-primary/10 px-4 py-2.5 text-sm text-foreground">
                {aviso}
              </p>
            )}
            {borrador && (
              <p role="status" className="rounded-[14px] bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                Recuperamos lo que escribiste la vez pasada. Guarda la hoja para que quede en el expediente.
              </p>
            )}
            <Hoja titulo={fechaDeHoja(entry?.date ?? sessionDate)}>
              <label htmlFor="hoja-notas" className="sr-only">
                Notas de la sesión
              </label>
              <textarea
                id="hoja-notas"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setDirty(true)
                }}
                autoFocus
                placeholder="Escribe aquí lo que quieras recordar de esta sesión…"
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? "hoja-error" : undefined}
                disabled={isSaving}
                style={RENGLONES}
                // Al llegar al margen derecho el texto baja al siguiente renglón; la hoja crece con lo escrito.
                ref={crecer}
                onInput={(event) => crecer(event.currentTarget)}
                wrap="soft"
                className="block min-h-64 w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap bg-transparent text-sm text-foreground outline-none [overflow-wrap:anywhere] placeholder:text-muted-foreground"
              />

              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm font-medium text-foreground">Tarea para casa</p>

                {tasks.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {tasks.map((task, index) => (
                      <li key={task.key} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            task.doneAt ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                          )}
                          title={task.doneAt ? "El paciente ya la hizo" : "Pendiente"}
                        >
                          {task.doneAt && <Check className="size-3" aria-hidden="true" />}
                        </span>
                        <input
                          value={task.text}
                          onChange={(event) => {
                            const text = event.target.value
                            setTasks((prev) => prev.map((t) => (t.key === task.key ? { ...t, text } : t)))
                            setDirty(true)
                          }}
                          maxLength={300}
                          aria-label={`Tarea ${index + 1}${task.doneAt ? " (hecha)" : ""}`}
                          disabled={isSaving}
                          className="h-9 min-w-0 flex-1 border-b border-border bg-transparent text-sm text-foreground outline-none transition-colors focus-visible:border-primary"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Quitar tarea ${index + 1}`}
                          disabled={isSaving}
                          onClick={() => {
                            setTasks((prev) => prev.filter((t) => t.key !== task.key))
                            setDirty(true)
                          }}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <input
                    ref={nuevaRef}
                    value={nueva}
                    onChange={(event) => {
                      setNueva(event.target.value)
                      setDirty(true)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        agregarTarea()
                      }
                    }}
                    maxLength={300}
                    placeholder="Escribe una tarea y presiona Enter"
                    aria-label="Nueva tarea"
                    disabled={isSaving || tasks.length >= 20}
                    className="h-10 min-w-0 flex-1 rounded-[14px] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                  <Button type="button" variant="outline" onClick={agregarTarea} disabled={isSaving || !nueva.trim()}>
                    <Plus />
                    Agregar
                  </Button>
                </div>
              </div>
            </Hoja>

            {error && (
              <p id="hoja-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => cerrar(false)}>
                Cerrar
              </Button>
              <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Guardando…
                  </>
                ) : (
                  "Guardar hoja"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
