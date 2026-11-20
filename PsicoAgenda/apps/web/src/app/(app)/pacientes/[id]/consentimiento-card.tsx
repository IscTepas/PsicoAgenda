"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, FileText, Loader2, Lock, Plus } from "lucide-react"
import { ConsentStatus, PDF_CONSENTIMIENTO_MAX_BYTES, type ClinicalRecord, type Patient } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { WheelDatePicker } from "@/components/wheel-date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatShortDate } from "@/lib/format"
import { clinicalRecordService } from "@/services"
import { FirmaEnPantalla } from "./firma-en-pantalla"

const CONSENT_STATUS: Record<ConsentStatus, { label: string; className: string; dot: string }> = {
  [ConsentStatus.SIGNED]: { label: "Vigente", className: "bg-primary/10 text-primary", dot: "bg-primary" },
  [ConsentStatus.EXPIRED]: { label: "Vencido", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  [ConsentStatus.WITHDRAWN]: { label: "Retirado", className: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
}

const DOCUMENTO_BASE = "Consentimiento informado para atención psicológica"
const hoyIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const leerComoBase64 = (archivo: File) =>
  new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).replace(/^data:[^,]*,/, ""))
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."))
    lector.readAsDataURL(archivo)
  })

/**
 * Consentimiento informado (NOM-004 10.1). Se firma en pantalla o se sube el PDF
 * firmado en papel, con el aviso de privacidad aceptado. Un menor lo firma su
 * tutor. Si se retira, se marca y queda el historial. Es requisito para escribir
 * notas de evolución.
 */
export function ConsentimientoCard({
  patient,
  consents,
  onRecord,
}: {
  patient: Patient
  consents: ClinicalRecord["consents"]
  onRecord: (record: ClinicalRecord) => void
}) {
  const tutores = patient.isMinor ? (patient.guardians ?? []) : []
  const vigente = consents.find((c) => c.status === ConsentStatus.SIGNED)
  const [abierto, setAbierto] = React.useState(false)
  const [fecha, setFecha] = React.useState(hoyIso)
  const [documento, setDocumento] = React.useState(DOCUMENTO_BASE)
  const [tutorId, setTutorId] = React.useState(tutores.find((t) => t.isPrimary)?.id ?? tutores[0]?.id ?? "")
  const [modo, setModo] = React.useState<"pantalla" | "pdf">("pantalla")
  const [firma, setFirma] = React.useState<string | null>(null)
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [aviso, setAviso] = React.useState(false)
  const [guardando, setGuardando] = React.useState(false)
  const [confirmarRetiro, setConfirmarRetiro] = React.useState(false)
  const [abriendoPdf, setAbriendoPdf] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const ejecutar = async (accion: () => Promise<ClinicalRecord>) => {
    setGuardando(true)
    setError(null)
    try {
      onRecord(await accion())
      setAbierto(false)
      setConfirmarRetiro(false)
      setFirma(null)
      setPdf(null)
      setAviso(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  const abrirPdf = async (consentId: string) => {
    setAbriendoPdf(consentId)
    setError(null)
    try {
      window.open(await clinicalRecordService.enlacePdf(patient.id, consentId), "_blank", "noopener,noreferrer")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el PDF.")
    } finally {
      setAbriendoPdf(null)
    }
  }

  const sinTutor = patient.isMinor && tutores.length === 0
  const pdfGrande = pdf !== null && pdf.size > PDF_CONSENTIMIENTO_MAX_BYTES
  const listo = aviso && fecha <= hoyIso() && (modo === "pantalla" ? Boolean(firma) : Boolean(pdf) && !pdfGrande)

  return (
    <Card className="border-border/70 shadow-2xs bg-card">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <span>Consentimiento informado</span>
          </CardTitle>
          {!abierto && (
            <Button
              type="button"
              size="sm"
              variant={vigente ? "ghost" : "default"}
              onClick={() => setAbierto(true)}
              disabled={sinTutor}
            >
              <Plus className="size-3.5" />
              {vigente ? "Registrar uno nuevo" : "Registrar firma"}
            </Button>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          {vigente
            ? `Vigente desde el ${formatShortDate(vigente.signedAt)}.`
            : sinTutor
              ? "Es menor de edad: agrega primero a su tutor para que firme."
              : "Sin consentimiento vigente. Es obligatorio antes de iniciar la terapia y de escribir notas de evolución."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {abierto && (
          <form
            className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!listo) return
              void ejecutar(async () =>
                clinicalRecordService.registrarConsentimiento(patient.id, {
                  signedAt: fecha,
                  document: documento.trim(),
                  guardianId: patient.isMinor ? tutorId : undefined,
                  signatureImage: modo === "pantalla" ? (firma ?? undefined) : undefined,
                  pdfBase64: modo === "pdf" && pdf ? await leerComoBase64(pdf) : undefined,
                  privacyNoticeAccepted: true,
                }),
              )
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="consentimiento-fecha">Fecha de firma</Label>
                <WheelDatePicker
                  id="consentimiento-fecha"
                  value={fecha}
                  onChange={setFecha}
                  defaultYear={new Date().getFullYear()}
                  fromYear={new Date().getFullYear() - 5}
                  toYear={new Date().getFullYear()}
                  invalid={fecha > hoyIso()}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="consentimiento-firmante">Firma</Label>
                {patient.isMinor ? (
                  <Select value={tutorId} onValueChange={setTutorId} className="w-full">
                    <SelectTrigger id="consentimiento-firmante" className="h-10 rounded-xl text-sm">
                      <SelectValue placeholder="Elige al tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tutores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.relationship ? `${t.name} (${t.relationship})` : t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="consentimiento-firmante"
                    value={`${patient.name} (el propio paciente)`}
                    readOnly
                    className="h-10 rounded-xl text-muted-foreground"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consentimiento-documento">Documento</Label>
              <Input
                id="consentimiento-documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                required
                minLength={3}
                maxLength={200}
                className="h-10 rounded-xl"
              />
            </div>

            {/* Firma en pantalla o PDF firmado en papel. */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Cómo se firmó</legend>
              <div role="radiogroup" className="inline-flex rounded-lg bg-muted/60 p-0.5 text-xs">
                {(
                  [
                    ["pantalla", "Firmar en pantalla"],
                    ["pdf", "Subir PDF firmado"],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={modo === valor}
                    onClick={() => setModo(valor)}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${modo === valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
              {modo === "pantalla" ? (
                <FirmaEnPantalla id="consentimiento-firma" onChange={setFirma} />
              ) : (
                <div className="space-y-1">
                  <Input
                    type="file"
                    accept="application/pdf"
                    aria-label="PDF firmado"
                    onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                    className="h-10 rounded-xl"
                  />
                  <p className={`text-xs ${pdfGrande ? "text-destructive" : "text-muted-foreground"}`}>
                    {pdfGrande ? "El PDF pesa más de 5 MB." : "Escanea el consentimiento firmado. Máximo 5 MB."}
                  </p>
                </div>
              )}
            </fieldset>

            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={aviso} onCheckedChange={(v) => setAviso(v === true)} className="mt-0.5" />
              <span>
                {patient.isMinor ? "El tutor recibió y aceptó" : "El paciente recibió y aceptó"} el aviso de privacidad
                (tratamiento confidencial de sus datos, LFPDPPP).
              </span>
            </label>

            {fecha > hoyIso() && (
              <p role="alert" className="text-sm text-destructive">
                La fecha de firma no puede ser futura.
              </p>
            )}
            {vigente && (
              <p className="text-xs text-muted-foreground">El consentimiento vigente pasará a vencido y quedará en el historial.</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={guardando || !listo} aria-busy={guardando}>
                {guardando && <Loader2 className="size-3.5 animate-spin" />}
                Guardar consentimiento
              </Button>
            </div>
          </form>
        )}

        {consents.length === 0 && !abierto ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            Aún no hay consentimientos registrados.
          </p>
        ) : (
          consents.map((consent) => {
            const estado = CONSENT_STATUS[consent.status]
            const esVigente = consent.status === ConsentStatus.SIGNED
            return (
              <div
                key={consent.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {consent.signatureImage && (
                    // La firma es un PNG propio (data URL), no hace falta optimizarla.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={consent.signatureImage}
                      alt={`Firma de ${consent.legalGuardian?.name ?? patient.name}`}
                      className="h-12 w-24 shrink-0 rounded-md border border-border/60 bg-white object-contain"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${estado.dot}`} aria-hidden="true" />
                      <span className="text-xs font-semibold text-foreground">{consent.document}</span>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      Firmado el {formatShortDate(consent.signedAt)} por{" "}
                      <strong className="font-semibold text-foreground">
                        {consent.legalGuardian?.name ?? "el propio paciente"}
                      </strong>
                      {consent.legalGuardian ? " (tutor legal)" : ""}.
                      {consent.privacyNoticeAccepted ? " Aviso de privacidad aceptado." : ""}
                      {consent.withdrawnAt ? ` Retirado el ${formatShortDate(consent.withdrawnAt)}.` : ""}
                    </p>
                    {consent.hasPdf &&
                      (consent.documentUrl ? (
                        <Link
                          href={consent.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Ver documento
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void abrirPdf(consent.id)}
                          disabled={abriendoPdf === consent.id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-60"
                        >
                          {abriendoPdf === consent.id ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
                          Ver PDF firmado
                        </button>
                      ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {esVigente &&
                    (confirmarRetiro ? (
                      <>
                        <span className="text-xs text-muted-foreground">¿Lo retiró?</span>
                        <Button type="button" size="sm" variant="ghost" disabled={guardando} onClick={() => setConfirmarRetiro(false)}>
                          No
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={guardando}
                          onClick={() => void ejecutar(() => clinicalRecordService.retirarConsentimiento(patient.id, consent.id))}
                        >
                          Sí, retirar
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setConfirmarRetiro(true)}
                      >
                        Retirar
                      </Button>
                    ))}
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estado.className}`}>
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {estado.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
        {error && !abierto && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
