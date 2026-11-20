"use client"

import * as React from "react"
import { BookmarkCheck, Edit3, Loader2, Lock, ShieldCheck } from "lucide-react"
import { APARTADOS_EXAMEN_MENTAL, CIE10_F, type ApartadoExamenMental, type ClinicalRecord } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatShortDate } from "@/lib/format"
import { clinicalRecordService, type ClinicalRecordPayload } from "@/services/clinical-record.service"
import { CampoDelExpediente } from "./campo-expediente"
import { ConfirmarConContrasena } from "./confirmar-contrasena"

const EXAMEN: Record<ApartadoExamenMental, { titulo: string; ayuda: string }> = {
  apariencia: { titulo: "Apariencia", ayuda: "Aliño, vestimenta, contacto visual" },
  conducta: { titulo: "Conducta", ayuda: "Actitud, psicomotricidad, cooperación" },
  animo: { titulo: "Estado de ánimo y afecto", ayuda: "Ánimo referido y afecto observado" },
  lenguaje: { titulo: "Lenguaje", ayuda: "Velocidad, volumen, coherencia" },
  pensamiento: { titulo: "Pensamiento", ayuda: "Curso, contenido, ideas de riesgo" },
  memoria: { titulo: "Memoria", ayuda: "Inmediata, reciente y remota" },
  orientacion: { titulo: "Orientación", ayuda: "Tiempo, lugar y persona" },
  juicio: { titulo: "Juicio e introspección", ayuda: "Conciencia de enfermedad y juicio" },
}

/**
 * Historia clínica psicológica (NOM-004 6.1), la de la primera sesión:
 * interrogatorio, exploración, evaluación y conclusión clínica. Se escribe en
 * borrador y se cierra con contraseña; cerrada queda sellada y ya no se edita.
 */
export function HistoriaClinica({
  patientId,
  record,
  onRecord,
}: {
  patientId: string
  record: ClinicalRecord
  onRecord: (record: ClinicalRecord) => void
}) {
  const [cerrando, setCerrando] = React.useState(false)
  const cerrada = record.historyStatus === "closed"
  const guardar = async (payload: ClinicalRecordPayload) => onRecord(await clinicalRecordService.update(patientId, payload))

  const campo = (
    titulo: string,
    clave: keyof Omit<ClinicalRecordPayload, "mentalExam" | "diagnosisSystem">,
    valor: string | undefined,
    opciones: { ayuda?: string; vacio?: string; max?: number; filas?: number; obligatorio?: boolean } = {},
  ) => (
    <CampoDelExpediente
      titulo={titulo}
      ayuda={opciones.ayuda}
      valor={valor}
      vacio={opciones.vacio ?? "Sin registrar."}
      max={opciones.max ?? 5000}
      filas={opciones.filas}
      bloqueado={cerrada}
      obligatorio={opciones.obligatorio}
      onGuardar={(v) => guardar({ [clave]: v })}
    />
  )
  // Lo mínimo para cerrar la historia; cada campo lo marca en su propio recuadro.
  const faltan = [
    !record.chiefComplaint && "motivo de consulta",
    !record.diagnosis && "impresión diagnóstica",
    !record.treatmentPlan && "plan terapéutico",
  ].filter(Boolean)

  return (
    <Card className="border-border/70 shadow-2xs bg-card">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
            <BookmarkCheck className="size-4 text-primary" />
            <span>Historia clínica psicológica</span>
          </CardTitle>
          {cerrada ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Cerrada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Borrador
            </span>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          {cerrada
            ? "Cerrada y sellada: ya no se modifica. Para corregir algo, agrega una nota aclaratoria en la bitácora."
            : "Se llena en la primera sesión. Al cerrarla queda sellada y ya se pueden escribir notas de evolución."}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-5 space-y-8">
        <section className="space-y-4" aria-labelledby="hc-interrogatorio">
          <h3 id="hc-interrogatorio" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            1. Interrogatorio
          </h3>
          {campo("Motivo de consulta", "chiefComplaint", record.chiefComplaint, { max: 2000, filas: 2, obligatorio: true })}
          {campo("Descripción del problema actual", "currentProblem", record.currentProblem)}
          {campo("Antecedentes heredofamiliares", "familyHistory", record.familyHistory, {
            ayuda: "Padecimientos mentales o físicos en la familia",
          })}
          {campo("Antecedentes personales no patológicos", "nonPathologicalHistory", record.nonPathologicalHistory, {
            ayuda: "Hábitos, sueño, alimentación, entorno familiar, escolar y laboral",
          })}
          {campo("Antecedentes personales patológicos", "pathologicalHistory", record.pathologicalHistory, {
            ayuda: "Enfermedades previas, medicamentos, consumo de sustancias, tratamientos anteriores",
          })}
          {record.background && (
            <CampoDelExpediente
              titulo="Antecedentes (registro anterior)"
              ayuda="Se capturaron antes de separar los antecedentes; solo lectura."
              valor={record.background}
              vacio=""
              max={5000}
              bloqueado
              onGuardar={async () => undefined}
            />
          )}
        </section>

        <section className="space-y-4" aria-labelledby="hc-exploracion">
          <h3 id="hc-exploracion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            2. Exploración: examen del estado mental
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {APARTADOS_EXAMEN_MENTAL.map((k) => (
              <CampoDelExpediente
                key={k}
                titulo={EXAMEN[k].titulo}
                ayuda={EXAMEN[k].ayuda}
                valor={record.mentalExam?.[k]}
                vacio="Sin registrar."
                max={1000}
                filas={2}
                bloqueado={cerrada}
                onGuardar={(v) => guardar({ mentalExam: { ...record.mentalExam, [k]: v } })}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="hc-evaluacion">
          <h3 id="hc-evaluacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            3. Evaluación
          </h3>
          {campo("Pruebas psicométricas o escalas aplicadas", "psychometricTests", record.psychometricTests, {
            ayuda: "Nombre de la prueba, fecha y resultados. Si no se aplicó ninguna, déjalo vacío.",
            vacio: "No se aplicaron pruebas.",
          })}
        </section>

        <section className="space-y-4" aria-labelledby="hc-conclusion">
          <h3 id="hc-conclusion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            4. Conclusión clínica
          </h3>
          <DiagnosticoCie record={record} bloqueado={cerrada} onGuardar={guardar} />
          {campo("Impresión diagnóstica", "diagnosis", record.diagnosis, { max: 500, filas: 2, obligatorio: true })}
          {campo("Pronóstico", "prognosis", record.prognosis, { max: 2000, filas: 2 })}
          {campo("Plan terapéutico", "treatmentPlan", record.treatmentPlan, {
            ayuda: "Objetivos, enfoque, frecuencia de sesiones",
            obligatorio: true,
          })}
        </section>

        <CampoDelExpediente
          titulo="Observaciones generales"
          ayuda="Siguen editables aunque la historia esté cerrada."
          valor={record.generalObservations}
          vacio="Sin observaciones registradas."
          max={5000}
          onGuardar={(v) => guardar({ generalObservations: v })}
        />

        <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {cerrada ? (
            <p className="text-xs text-muted-foreground">
              Cerrada el {record.historyClosedAt ? formatShortDate(record.historyClosedAt) : "—"} · sello{" "}
              <span className="font-mono">{record.historyHash?.slice(0, 16)}…</span>
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {faltan.length > 0
                  ? `Para cerrarla falta: ${faltan.join(", ")} (marcados con *).`
                  : "Lista para cerrar. Después ya no se podrá modificar."}
              </p>
              <Button type="button" disabled={faltan.length > 0} onClick={() => setCerrando(true)}>
                <Lock />
                Cerrar historia clínica
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <ConfirmarConContrasena
        open={cerrando}
        onOpenChange={setCerrando}
        titulo="Cerrar historia clínica"
        descripcion="Se sellará con tu nombre, cédula y la hora del servidor. Después ya no se podrá modificar."
        accion="Cerrar y sellar"
        onConfirmar={async (password) => onRecord(await clinicalRecordService.cerrarHistoria(patientId, password))}
      />
    </Card>
  )
}

/** Código CIE de la impresión diagnóstica, con búsqueda en el capítulo F de la CIE-10. */
function DiagnosticoCie({
  record,
  bloqueado,
  onGuardar,
}: {
  record: ClinicalRecord
  bloqueado: boolean
  onGuardar: (payload: ClinicalRecordPayload) => Promise<void>
}) {
  const [editando, setEditando] = React.useState(false)
  const [sistema, setSistema] = React.useState<"CIE-10" | "CIE-11">(record.diagnosisSystem ?? "CIE-10")
  const [codigo, setCodigo] = React.useState(record.diagnosisCode ?? "")
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const listaId = React.useId()
  const etiqueta = CIE10_F.find((c) => c.code === (record.diagnosisCode ?? "").slice(0, 3))?.label

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const limpio = codigo.trim().split(/\s/)[0]?.toUpperCase() ?? ""
      const sugerida = CIE10_F.find((c) => c.code === limpio.slice(0, 3))?.label
      await onGuardar({
        diagnosisCode: limpio,
        diagnosisSystem: limpio ? sistema : undefined,
        // Si aún no hay descripción, se propone la del catálogo.
        diagnosis: !record.diagnosis && sistema === "CIE-10" && sugerida ? sugerida : undefined,
      })
      setEditando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Código diagnóstico</h4>
          <p className="text-xs text-muted-foreground">CIE-10 (capítulo F) o CIE-11</p>
        </div>
        {!editando && !bloqueado && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              setCodigo(record.diagnosisCode ?? "")
              setSistema(record.diagnosisSystem ?? "CIE-10")
              setEditando(true)
            }}
          >
            <Edit3 className="size-3.5" />
            Editar
          </Button>
        )}
      </div>
      {editando ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg bg-muted/60 p-0.5 text-xs" role="radiogroup" aria-label="Catálogo">
              {(["CIE-10", "CIE-11"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={sistema === s}
                  onClick={() => setSistema(s)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${sistema === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="min-w-56 flex-1">
              <Label htmlFor={`${listaId}-codigo`} className="sr-only">
                Código
              </Label>
              <Input
                id={`${listaId}-codigo`}
                list={sistema === "CIE-10" ? listaId : undefined}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder={sistema === "CIE-10" ? "Escribe el código o busca, p. ej. F41" : "Código CIE-11, p. ej. 6B00"}
                className="h-10 rounded-xl"
                maxLength={120}
                autoFocus
              />
              <datalist id={listaId}>
                {CIE10_F.map((c) => (
                  <option key={c.code} value={`${c.code} ${c.label}`} />
                ))}
              </datalist>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={guardando} aria-busy={guardando} onClick={() => void guardar()}>
              {guardando && <Loader2 className="size-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <p className={`rounded-xl bg-muted/20 p-3.5 text-sm ${record.diagnosisCode ? "text-foreground" : "text-muted-foreground"}`}>
          {record.diagnosisCode ? (
            <>
              <span className="font-mono font-medium">{record.diagnosisCode}</span>
              <span className="text-muted-foreground"> · {record.diagnosisSystem ?? "CIE-10"}</span>
              {record.diagnosisSystem !== "CIE-11" && etiqueta && <span className="text-muted-foreground"> · {etiqueta}</span>}
            </>
          ) : (
            "Sin código."
          )}
        </p>
      )}
    </section>
  )
}
