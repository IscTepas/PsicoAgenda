import type { ConsultationReason, ConsultationReasonGroup } from "@psicoagenda/shared";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";

type Fila = Prisma.motivos_consultaGetPayload<object>;

export const toConsultationReason = (row: Fila): ConsultationReason => ({
  id: row.id,
  code: row.codigo,
  label: row.etiqueta,
  category: row.categoria,
  active: row.activo,
  order: row.orden,
  isOther: row.es_otro,
  requiresText: row.requiere_texto,
});

/**
 * Lo que la cita o solicitud expone como `reason`: la etiqueta del catálogo, salvo
 * en «Otro» y en lo histórico (sin `motivo_id`), donde manda el texto libre.
 */
export const reasonText = (
  texto: string | null,
  motivo: { etiqueta: string; requiere_texto: boolean } | null,
): string | undefined => {
  if (!motivo) return texto ?? undefined;
  return motivo.requiere_texto ? (texto ?? motivo.etiqueta) : motivo.etiqueta;
};

/**
 * Valida el motivo elegido y devuelve las columnas a guardar. Sin `reasonId` se
 * acepta el texto libre tal cual (compatibilidad con clientes anteriores).
 */
export async function resolveReason(
  db: Prisma.TransactionClient,
  reasonId: string | undefined,
  text: string | undefined,
): Promise<{ motivo_id: string | null; motivo: string | null }> {
  const libre = text?.trim() || null;
  if (!reasonId) return { motivo_id: null, motivo: libre };

  const motivo = await db.motivos_consulta.findUnique({ where: { id: reasonId } });
  if (!motivo || !motivo.activo) {
    throw AppError.badRequest("El motivo de consulta elegido no está disponible.");
  }
  if (motivo.requiere_texto && !libre) {
    throw AppError.badRequest(`Describe el motivo de la consulta para «${motivo.etiqueta}».`);
  }
  // Con un motivo del catálogo el texto solo vale en «Otro»: una sola fuente de verdad.
  return { motivo_id: motivo.id, motivo: motivo.requiere_texto ? libre : null };
}

const ORDEN = [{ orden: "asc" }, { etiqueta: "asc" }] satisfies Prisma.motivos_consultaOrderByWithRelationInput[];

/** Motivos activos agrupados por categoría, en el orden del catálogo. */
export async function listActiveReasons(): Promise<ConsultationReasonGroup[]> {
  const filas = await prisma.motivos_consulta.findMany({ where: { activo: true }, orderBy: ORDEN });
  const grupos = new Map<string, ConsultationReason[]>();
  for (const fila of filas) {
    const lista = grupos.get(fila.categoria) ?? [];
    lista.push(toConsultationReason(fila));
    grupos.set(fila.categoria, lista);
  }
  return [...grupos].map(([category, reasons]) => ({ category, reasons }));
}

export async function listAllReasons(): Promise<ConsultationReason[]> {
  const filas = await prisma.motivos_consulta.findMany({ orderBy: ORDEN });
  return filas.map(toConsultationReason);
}

export interface ReasonInput {
  code?: string;
  label?: string;
  category?: string;
  order?: number;
  isOther?: boolean;
  requiresText?: boolean;
  active?: boolean;
}

const columnas = (input: ReasonInput) => ({
  etiqueta: input.label,
  categoria: input.category,
  orden: input.order,
  es_otro: input.isOther,
  // «Otro» siempre exige texto: es la regla de datos que lo distingue.
  requiere_texto: input.isOther ? true : input.requiresText,
  activo: input.active,
});

export async function createReason(input: Required<Pick<ReasonInput, "code" | "label" | "category">> & ReasonInput) {
  try {
    const fila = await prisma.motivos_consulta.create({
      data: { ...columnas(input), codigo: input.code, etiqueta: input.label, categoria: input.category },
    });
    return toConsultationReason(fila);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("Ya existe un motivo con ese código.");
    }
    throw error;
  }
}

export async function updateReason(id: string, input: ReasonInput) {
  try {
    const fila = await prisma.motivos_consulta.update({ where: { id }, data: columnas(input) });
    return toConsultationReason(fila);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw AppError.notFound("Motivo no encontrado.");
    }
    throw error;
  }
}

/** Solo se borra lo que nunca se usó; lo usado se desactiva (FK RESTRICT). */
export async function deleteReason(id: string): Promise<void> {
  try {
    await prisma.motivos_consulta.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        throw AppError.conflict("El motivo está en uso; desactívalo en lugar de borrarlo.");
      }
      if (error.code === "P2025") throw AppError.notFound("Motivo no encontrado.");
    }
    throw error;
  }
}
