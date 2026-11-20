"use client"

import { useQuery } from "@tanstack/react-query"
import { clinicalRecordService } from "@/services"

const ACCIONES: Record<string, string> = {
  VER_EXPEDIENTE: "Consultó el expediente",
  VER_NOTAS: "Consultó la bitácora",
  CREAR_NOTA: "Creó una nota",
  EDITAR_NOTA: "Editó un borrador de nota",
  CERRAR_NOTA: "Cerró y selló una nota",
  NOTA_ACLARATORIA: "Agregó una nota aclaratoria",
  EDITAR_HISTORIA: "Editó la historia clínica",
  CERRAR_HISTORIA: "Cerró y selló la historia clínica",
  REGISTRAR_CONSENTIMIENTO: "Registró un consentimiento",
  RETIRAR_CONSENTIMIENTO: "Marcó un consentimiento como retirado",
  DESCARGAR_CONSENTIMIENTO: "Abrió el PDF de un consentimiento",
  IMPRIMIR_EXPEDIENTE: "Imprimió o descargó el expediente",
  BAJA_PACIENTE: "Dio de baja al paciente",
}

/**
 * Bitácora de auditoría del expediente (NOM-024): quién hizo qué, desde qué IP y
 * a qué hora del servidor. Solo lectura; la base no deja modificarla.
 */
export function AccesosExpediente({ patientId }: { patientId: string }) {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["expediente", patientId, "auditoria"],
    queryFn: () => clinicalRecordService.auditoria(patientId),
  })

  if (isLoading) return <div className="h-40 rounded-2xl bg-muted/40 animate-pulse motion-reduce:animate-none" aria-busy="true" />
  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        No se pudo cargar la bitácora de accesos.{" "}
        <button type="button" onClick={() => void refetch()} className="font-medium text-primary hover:underline">
          Reintentar
        </button>
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Cada consulta y cambio del expediente queda registrado aquí. Nadie puede editar ni borrar estos registros.
      </p>
      {data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Aún no hay registros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-2.5 font-medium">Fecha y hora</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Quién</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Acción</th>
                <th scope="col" className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                    {a.createdAt.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "medium" })}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{a.userName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-foreground">{ACCIONES[a.action] ?? a.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
