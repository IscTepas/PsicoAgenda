"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FileDown, Printer } from "lucide-react"
import {
  APARTADOS_EXAMEN_MENTAL,
  ConsentStatus,
  RecordStatus,
  type ClinicalRecord,
  type Patient,
  type SessionLogEntry,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { clinicalRecordService, logEntryService, patientService } from "@/services"
import { edadDe, folioDe } from "../caratula"

const fechaLarga = (d?: Date) =>
  d ? d.toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

// El consentimiento solo guarda el día de la firma (se registra a mediodía para no correr la fecha).
const soloFecha = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })

const TITULO_NOTA: Record<SessionLogEntry["kind"], string> = {
  evolution: "Nota de evolución",
  referral: "Nota de interconsulta / referencia",
  discharge: "Nota de egreso / alta terapéutica",
  clarification: "Nota aclaratoria",
}

const EXAMEN: Record<(typeof APARTADOS_EXAMEN_MENTAL)[number], string> = {
  apariencia: "Apariencia",
  conducta: "Conducta",
  animo: "Estado de ánimo y afecto",
  lenguaje: "Lenguaje",
  pensamiento: "Pensamiento",
  memoria: "Memoria",
  orientacion: "Orientación",
  juicio: "Juicio e introspección",
}

const estadoConsentimiento = (s: ConsentStatus) =>
  s === ConsentStatus.SIGNED ? "Vigente" : s === ConsentStatus.WITHDRAWN ? "Retirado" : "Vencido"

function Seccion({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-2">
      <h2 className="break-after-avoid border-b border-gray-400 pb-1 text-[13px] font-semibold uppercase tracking-wide">
        {numero}. {titulo}
      </h2>
      {children}
    </section>
  )
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return <h3 className="break-after-avoid pt-2 text-[12px] font-semibold text-gray-700">{children}</h3>
}

function Apartado({ titulo, texto, vacio = "Sin registrar." }: { titulo: string; texto?: string; vacio?: string }) {
  return (
    <div className="break-inside-avoid">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-600">{titulo}</h4>
      <p className={`whitespace-pre-wrap ${texto ? "" : "text-gray-500"}`}>{texto || vacio}</p>
    </div>
  )
}

function Sello({ quien, en, hash }: { quien: string; en?: Date; hash?: string }) {
  return (
    <p className="mt-1 text-[11px] text-gray-600">
      Cerrada por {quien} el {fechaLarga(en)} · sello SHA-256 <span className="font-mono break-all">{hash}</span>
    </p>
  )
}

/**
 * Expediente completo para imprimir o guardar en PDF (NOM-004): encabezado del
 * establecimiento, ficha, consentimientos, historia clínica, notas con su sello y
 * firma del responsable. Abrirlo queda auditado. Siempre negro sobre blanco.
 */
export function ExpedienteImprimible({ patientId }: { patientId: string }) {
  const [datos, setDatos] = React.useState<{
    patient: Patient
    record: ClinicalRecord
    logs: SessionLogEntry[]
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelado = false
    const tituloAnterior = document.title
    Promise.all([
      patientService.get(patientId),
      clinicalRecordService.get(patientId),
      logEntryService.list(patientId),
      clinicalRecordService.registrarImpresion(patientId),
    ])
      .then(([patient, record, logs]) => {
        if (cancelado) return
        setDatos({ patient, record, logs })
        // El navegador usa el título de la página como nombre del PDF.
        document.title = `Expediente ${folioDe(record.folio)} - ${patient.name}`
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : "No se pudo cargar el expediente.")
      })
    return () => {
      cancelado = true
      document.title = tituloAnterior
    }
  }, [patientId])

  if (error) return <p role="alert" className="p-6 text-sm text-destructive">{error}</p>
  if (!datos) return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-muted/40" aria-busy="true" />

  const { patient, record, logs } = datos
  const f = record.facility
  const edad = edadDe(patient.birthDate)
  const notas = [...logs].filter((l) => l.kind !== "clarification").sort((a, b) => a.date.getTime() - b.date.getTime())
  const aclaraciones = (id: string) => logs.filter((l) => l.parentId === id)

  return (
    <div className="mx-auto max-w-3xl space-y-4 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={`/pacientes/${patientId}`}>
            <ArrowLeft />
            Volver al expediente
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="hidden text-xs text-muted-foreground md:block">Para PDF, elige «Guardar como PDF» como destino.</p>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <FileDown />
            Guardar PDF
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer />
            Imprimir
          </Button>
        </div>
      </div>

      <article className="rounded-xl bg-white p-10 text-[13px] leading-relaxed text-gray-900 shadow-sm print:rounded-none print:p-0 print:shadow-none">
        {/* Encabezado del establecimiento (NOM-004 5.2) */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-gray-900 pb-3">
          <div className="min-w-0">
            <p className="text-base font-semibold">{f.name ?? "Consultorio de psicología"}</p>
            <p className="text-gray-600">{f.type}</p>
            <p className="text-gray-600">{f.address ?? "Domicilio no registrado"}</p>
            <p className="mt-1">
              Responsable: <strong>{f.psychologistName}</strong> · Cédula profesional {f.licenseNumber}
            </p>
          </div>
          <div className="shrink-0 rounded border border-gray-900 px-3 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-600">Expediente</p>
            <p className="whitespace-nowrap font-mono text-sm font-semibold">{folioDe(record.folio)}</p>
          </div>
        </header>

        <h1 className="mt-5 text-center text-lg font-semibold uppercase tracking-[0.2em]">Expediente clínico</h1>

        <Seccion numero={1} titulo="Ficha de identificación">
          <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-gray-600">Paciente</dt>
            <dd className="col-span-3 font-semibold">{patient.name}</dd>
            <dt className="text-gray-600">Edad</dt>
            <dd>{edad !== null ? `${edad} años` : "—"}</dd>
            <dt className="text-gray-600">Sexo</dt>
            <dd>{patient.gender ?? "—"}</dd>
            <dt className="text-gray-600">Domicilio</dt>
            <dd className="col-span-3">{patient.address ?? "—"}</dd>
            <dt className="text-gray-600">Apertura</dt>
            <dd>{soloFecha(record.openedAt)}</dd>
            <dt className="text-gray-600">Estado</dt>
            <dd>{record.status === RecordStatus.ACTIVE ? "Activo" : "Inactivo"}</dd>
          </dl>
        </Seccion>

        <Seccion numero={2} titulo="Consentimiento informado">
          {record.consents.length === 0 ? (
            <p>Sin consentimientos registrados.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-400 text-left text-[11px] uppercase tracking-wide text-gray-600">
                  <th className="py-1 pr-3 font-medium">Documento</th>
                  <th className="py-1 pr-3 font-medium">Fecha</th>
                  <th className="py-1 pr-3 font-medium">Firmó</th>
                  <th className="py-1 pr-3 font-medium">Estado</th>
                  <th className="py-1 font-medium">Firma</th>
                </tr>
              </thead>
              <tbody>
                {record.consents.map((c) => (
                  <tr key={c.id} className="break-inside-avoid border-b border-gray-200 align-middle">
                    <td className="py-1.5 pr-3">
                      {c.document}
                      <span className="block text-[11px] text-gray-600">
                        {c.privacyNoticeAccepted ? "Aviso de privacidad aceptado" : "Sin aviso de privacidad registrado"}
                        {c.hasPdf ? " · PDF firmado en archivo" : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-3">{soloFecha(c.signedAt)}</td>
                    <td className="py-1.5 pr-3">{c.legalGuardian ? `${c.legalGuardian.name} (tutor)` : patient.name}</td>
                    <td className="py-1.5 pr-3">{estadoConsentimiento(c.status)}</td>
                    <td className="py-1.5">
                      {c.signatureImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.signatureImage} alt="Firma" className="h-10 w-24 object-contain" />
                      ) : (
                        <span className="text-gray-600">{c.hasPdf ? "En PDF" : "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Seccion>

        <Seccion
          numero={3}
          titulo={`Historia clínica psicológica${record.historyStatus === "closed" ? "" : " (borrador, sin cerrar)"}`}
        >
          <Subtitulo>Interrogatorio</Subtitulo>
          <Apartado titulo="Motivo de consulta" texto={record.chiefComplaint} />
          <Apartado titulo="Problema actual" texto={record.currentProblem} />
          <Apartado titulo="Antecedentes heredofamiliares" texto={record.familyHistory} />
          <Apartado titulo="Antecedentes personales no patológicos" texto={record.nonPathologicalHistory} />
          <Apartado titulo="Antecedentes personales patológicos" texto={record.pathologicalHistory} />
          {record.background && <Apartado titulo="Antecedentes (registro anterior)" texto={record.background} />}
          <Subtitulo>Examen del estado mental</Subtitulo>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {APARTADOS_EXAMEN_MENTAL.map((k) => (
              <Apartado key={k} titulo={EXAMEN[k]} texto={record.mentalExam?.[k]} />
            ))}
          </div>
          <Subtitulo>Evaluación</Subtitulo>
          <Apartado titulo="Pruebas psicométricas" texto={record.psychometricTests} vacio="No se aplicaron pruebas." />
          <Subtitulo>Conclusión clínica</Subtitulo>
          <Apartado
            titulo="Impresión diagnóstica"
            texto={[record.diagnosisCode && `${record.diagnosisCode} (${record.diagnosisSystem ?? "CIE-10"})`, record.diagnosis]
              .filter(Boolean)
              .join(" · ")}
          />
          <Apartado titulo="Pronóstico" texto={record.prognosis} />
          <Apartado titulo="Plan terapéutico" texto={record.treatmentPlan} />
          {record.historyStatus === "closed" && (
            <Sello quien={`${f.psychologistName}, cédula ${f.licenseNumber}`} en={record.historyClosedAt} hash={record.historyHash} />
          )}
        </Seccion>

        <Seccion numero={4} titulo="Notas">
          {notas.length === 0 && <p>Sin notas.</p>}
          <div className="space-y-4">
            {notas.map((n) => (
              <div key={n.id} className="break-inside-avoid border-l-2 border-gray-300 pl-3">
                <p className="font-semibold">
                  {TITULO_NOTA[n.kind]}
                  {n.kind === "evolution" ? ` · sesión ${n.sessionNumber}` : ""}
                  <span className="font-normal text-gray-600"> · {fechaLarga(n.date)}</span>
                  {n.status === "draft" && <span className="font-normal text-gray-600"> · borrador, sin cerrar</span>}
                </p>
                {n.referredTo && <p>Se refiere a: {n.referredTo}</p>}
                {n.referralReason && <p>Motivo de la referencia: {n.referralReason}</p>}
                {n.dischargeReason && <p>Motivo del egreso: {n.dischargeReason}</p>}
                <p className="whitespace-pre-wrap">{n.notes}</p>
                {n.interventions && <p className="whitespace-pre-wrap">Intervenciones: {n.interventions}</p>}
                {n.homework && <p className="whitespace-pre-wrap">Plan: {n.homework}</p>}
                {n.dischargeSummary && <p className="whitespace-pre-wrap">Resumen del tratamiento: {n.dischargeSummary}</p>}
                {n.status === "closed" && (
                  <Sello quien={`${n.closedByName}, cédula ${n.closedByLicense}`} en={n.closedAt} hash={n.hash} />
                )}
                {aclaraciones(n.id).map((a) => (
                  <div key={a.id} className="mt-2 ml-3 border-l-2 border-gray-400 pl-3">
                    <p className="text-[12px] font-semibold">Nota aclaratoria · {fechaLarga(a.date)}</p>
                    <p className="whitespace-pre-wrap">{a.notes}</p>
                    <Sello quien={`${a.closedByName}, cédula ${a.closedByLicense}`} en={a.closedAt} hash={a.hash} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Seccion>

        {/* Firma del responsable */}
        <div className="mt-14 flex break-inside-avoid justify-end">
          <div className="w-72 border-t border-gray-900 pt-1 text-center">
            <p className="font-semibold">{f.psychologistName}</p>
            <p className="text-gray-600">Cédula profesional {f.licenseNumber}</p>
          </div>
        </div>

        <footer className="mt-8 border-t border-gray-300 pt-2 text-[11px] text-gray-600">
          Documento confidencial, conforme a la NOM-004-SSA3-2012 · Generado el {fechaLarga(new Date())}
          {record.retainUntil && ` · Se conserva hasta el ${soloFecha(record.retainUntil)}`}
        </footer>
      </article>
    </div>
  )
}
