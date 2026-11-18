"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Save } from "lucide-react"
import {
  AppointmentModality,
  calculateAppointmentPrice,
  pricingRatesSchema,
  type PricingRates,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/toast-provider"
import { psychologistService } from "@/services"

const CLAVE = ["psicologo", "yo"]

/** Campos de texto del formulario; `recargo` es porcentaje o monto según el modo. */
type Campo = "adultRate" | "minorRate" | "recargo" | "virtualDiscount"
type ModoRecargo = "porcentaje" | "monto"

const pesos = (monto: number) => `$${monto.toLocaleString("es-MX")}`

// Mañana y hoy: dos fechas que muestran el precio sin y con recargo de mismo día.
const fechaDeEjemplo = (mismoDia: boolean) => {
  const fecha = new Date()
  if (!mismoDia) fecha.setDate(fecha.getDate() + 1)
  return fecha
}

const precioDe = (tarifas: PricingRates, isMinor: boolean, modality: AppointmentModality, mismoDia: boolean) =>
  calculateAppointmentPrice(
    { isMinor, modality, startTime: fechaDeEjemplo(mismoDia), durationMinutes: isMinor ? 30 : 50 },
    tarifas,
  )

const FILAS = [
  { nombre: "Adulto · presencial", isMinor: false, modality: AppointmentModality.IN_PERSON },
  { nombre: "Adulto · videollamada", isMinor: false, modality: AppointmentModality.VIRTUAL },
  { nombre: "Menor · presencial", isMinor: true, modality: AppointmentModality.IN_PERSON },
  { nombre: "Menor · videollamada", isMinor: true, modality: AppointmentModality.VIRTUAL },
]

/** Tarifas con las que se calcula el costo de cada cita nueva. Solo la psicóloga las ve. */
export function CostosCitas() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: perfil } = useQuery({ queryKey: CLAVE, queryFn: () => psychologistService.getMe() })

  // El borrador guarda texto: un campo a medio escribir ("", "8") no es un número todavía.
  const [borrador, setBorrador] = useState<Partial<Record<Campo, string>>>({})
  const [modoElegido, setModoElegido] = useState<ModoRecargo | null>(null)
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})

  const guardar = useMutation({
    mutationFn: (rates: PricingRates) => psychologistService.updateMe({ rates }),
    onSuccess: (guardado) => {
      queryClient.setQueryData(CLAVE, guardado)
      setBorrador({})
      setModoElegido(null)
      toast({ title: "Costos actualizados", description: "Aplican a las citas que se agenden desde ahora.", status: "success" })
    },
    onError: (error) =>
      toast({
        title: "No se pudieron guardar los costos",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        status: "error",
      }),
  })

  if (!perfil) return null

  const guardadas = perfil.rates
  const modoGuardado: ModoRecargo = guardadas.sameDaySurchargeAmount != null ? "monto" : "porcentaje"
  const modo = modoElegido ?? modoGuardado

  const guardado: Record<Campo, number> = {
    adultRate: guardadas.adultRate,
    minorRate: guardadas.minorRate,
    virtualDiscount: guardadas.virtualDiscount,
    // Al cambiar de modo el campo empieza vacío: 30 % no significa $30.
    recargo: modo === "monto" ? (guardadas.sameDaySurchargeAmount ?? NaN) : guardadas.sameDaySurchargePercent,
  }
  const valorDe = (campo: Campo) => borrador[campo] ?? (Number.isNaN(guardado[campo]) ? "" : String(guardado[campo]))
  const numeroDe = (campo: Campo) => (valorDe(campo).trim() === "" ? undefined : Number(valorDe(campo)))

  // Lo escrito, con la forma que espera el servidor. El modo que no se usa conserva su valor guardado.
  const candidato = {
    adultRate: numeroDe("adultRate"),
    minorRate: numeroDe("minorRate"),
    virtualDiscount: numeroDe("virtualDiscount"),
    sameDaySurchargePercent: modo === "porcentaje" ? numeroDe("recargo") : guardadas.sameDaySurchargePercent,
    sameDaySurchargeAmount: modo === "monto" ? numeroDe("recargo") : null,
  }
  const validacion = pricingRatesSchema.safeParse(candidato)
  const tarifasVistaPrevia: PricingRates = {
    adultRate: candidato.adultRate ?? 0,
    minorRate: candidato.minorRate ?? 0,
    virtualDiscount: candidato.virtualDiscount ?? 0,
    sameDaySurchargePercent: candidato.sameDaySurchargePercent ?? 0,
    sameDaySurchargeAmount: modo === "monto" ? (candidato.sameDaySurchargeAmount ?? 0) : null,
  }
  const hayCambios =
    modo !== modoGuardado ||
    (["adultRate", "minorRate", "recargo", "virtualDiscount"] as const).some((campo) => numeroDe(campo) !== guardado[campo])

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!validacion.success) {
      const nuevos: Partial<Record<Campo, string>> = {}
      for (const issue of validacion.error.issues) {
        const clave = String(issue.path[0])
        const campo: Campo = clave.startsWith("sameDay") ? "recargo" : (clave as Campo)
        // Un campo vacío llega como "requerido"; el mensaje propio es más claro.
        nuevos[campo] ??= numeroDe(campo) === undefined ? "Escribe una cantidad" : issue.message
      }
      setErrores(nuevos)
      return
    }
    setErrores({})
    guardar.mutate(validacion.data)
  }

  const campo = (clave: Campo, etiqueta: string, ayuda: string, unidad: "$" | "%", extra?: React.ReactNode) => {
    const error = errores[clave]
    return (
      <div key={clave} className="space-y-1.5">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <label htmlFor={`costo-${clave}`} className="text-sm font-medium text-foreground">
            {etiqueta}
          </label>
          {extra}
        </div>
        <div className="relative">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 flex items-center text-sm text-muted-foreground ${unidad === "$" ? "left-3.5" : "right-3.5"}`}
          >
            {unidad}
          </span>
          <Input
            id={`costo-${clave}`}
            inputMode="numeric"
            autoComplete="off"
            value={valorDe(clave)}
            onChange={(e) => {
              // Solo dígitos: los montos son pesos enteros.
              const texto = e.target.value.replace(/\D/g, "").slice(0, 6)
              setBorrador((prev) => ({ ...prev, [clave]: texto }))
              setErrores((prev) => ({ ...prev, [clave]: undefined }))
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={`costo-${clave}-ayuda`}
            className={`h-11 rounded-xl text-sm tabular-nums bg-background border-border/80 ${unidad === "$" ? "pl-8" : "pr-9"}`}
          />
        </div>
        <p id={`costo-${clave}-ayuda`} className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? ayuda}
        </p>
      </div>
    )
  }

  const cambiarModo = (nuevo: ModoRecargo) => {
    if (nuevo === modo) return
    setModoElegido(nuevo)
    setBorrador((prev) => ({ ...prev, recargo: undefined }))
    setErrores((prev) => ({ ...prev, recargo: undefined }))
  }

  // Control segmentado: la selección se marca con superficie, como en el resto de la app.
  const selectorDeModo = (
    <div role="group" aria-label="Tipo de recargo" className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
      {(
        [
          ["porcentaje", "Porcentaje"],
          ["monto", "Monto fijo"],
        ] as const
      ).map(([valor, texto]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={modo === valor}
          onClick={() => cambiarModo(valor)}
          className={`h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
            modo === valor ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  )

  return (
    <form onSubmit={enviar} noValidate>
      <Card className="border-border/80 bg-card rounded-2xl shadow-2xs overflow-hidden">
        <CardContent className="p-5 sm:p-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="grid gap-5 sm:grid-cols-2 content-start">
            {campo("adultRate", "Sesión de adulto", "Tarifa base por sesión.", "$")}
            {campo("minorRate", "Sesión de menor de edad", "Tarifa base; la sesión dura 30 min.", "$")}
            <div className="sm:col-span-2">
              {campo(
                "recargo",
                "Recargo por emergencia",
                modo === "monto"
                  ? "Monto que se suma cuando la cita es para el mismo día."
                  : "Porcentaje que se suma cuando la cita es para el mismo día.",
                modo === "monto" ? "$" : "%",
                selectorDeModo,
              )}
            </div>
            <div className="sm:col-span-2">
              {campo("virtualDiscount", "Descuento por videollamada", "Se resta en las sesiones virtuales.", "$")}
            </div>
          </div>

          {/* Así queda cada combinación con lo que está escrito, antes de guardar */}
          <div className="self-start rounded-xl border border-border/70 bg-muted/20 p-4">
            <table className="w-full text-sm">
              <caption className="pb-3 text-left text-sm font-medium text-foreground">Lo que pagará el paciente</caption>
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 text-left font-normal">Sesión</th>
                  <th scope="col" className="pb-2 text-right font-normal">Normal</th>
                  <th scope="col" className="pb-2 text-right font-normal">Mismo día</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {FILAS.map((fila) => (
                  <tr key={fila.nombre}>
                    <th scope="row" className="py-2 text-left font-normal text-foreground">{fila.nombre}</th>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {pesos(precioDe(tarifasVistaPrevia, fila.isMinor, fila.modality, false))}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {pesos(precioDe(tarifasVistaPrevia, fila.isMinor, fila.modality, true))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <Button
              type="submit"
              disabled={!hayCambios || guardar.isPending}
              className="h-11 px-6 rounded-xl font-semibold text-sm"
            >
              <Save className="mr-1.5 size-4" />
              {guardar.isPending ? "Guardando..." : "Guardar costos"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
