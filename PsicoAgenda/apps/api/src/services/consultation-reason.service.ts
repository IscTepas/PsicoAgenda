import {
  isReasonAllowedFor,
  type ConsultationReason,
  type ConsultationReasonGroup,
} from "@psicoagenda/shared";
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

/** Lo que hay que incluir de las tablas de enlace (citas_motivos / solicitudes_motivos). */
export const reasonLinks = {
  select: { motivos_consulta: { select: { id: true, etiqueta: true, requiere_texto: true, orden: true } } },
} as const;

type Enlace = { motivos_consulta: { id: string; etiqueta: string; requiere_texto: boolean; orden: number } };

/**
 * Lo que la cita o solicitud expone como `reason`: las etiquetas elegidas en el
 * orden del catálogo, con el texto escrito en lugar de «Otro». Sin motivos del
 * catálogo (lo histórico) manda el texto libre.
 */
export const reasonText = (texto: string | null, enlaces: Enlace[] = []): string | undefined => {
  if (enlaces.length === 0) return texto ?? undefined;
  return [...enlaces]
    .sort((a, b) => a.motivos_consulta.orden - b.motivos_consulta.orden)
    .map(({ motivos_consulta: m }) => (m.requiere_texto ? (texto ?? m.etiqueta) : m.etiqueta))
    .join(", ");
};

/** El texto de «Otro», solo si «Otro» está entre los motivos elegidos. */
export const reasonOtherOf = (texto: string | null, enlaces: Enlace[] = []): string | undefined =>
  enlaces.some((e) => e.motivos_consulta.requiere_texto) ? (texto ?? undefined) : undefined;

export const reasonIdsOf = (enlaces: Enlace[] = []): string[] => enlaces.map((e) => e.motivos_consulta.id);

/**
 * Valida los motivos elegidos (uno o varios) y devuelve qué guardar. Sin motivos
 * se acepta el texto libre tal cual (compatibilidad con clientes anteriores).
 */
export async function resolveReasons(
  db: Prisma.TransactionClient,
  reasonIds: string[] | undefined,
  text: string | undefined,
  isMinor = false,
): Promise<{ motivoIds: string[]; motivo: string | null }> {
  const libre = text?.trim() || null;
  const ids = [...new Set(reasonIds ?? [])];
  if (ids.length === 0) return { motivoIds: [], motivo: libre };

  const motivos = await db.motivos_consulta.findMany({ where: { id: { in: ids } } });
  if (motivos.length !== ids.length || motivos.some((m) => !m.activo)) {
    throw AppError.badRequest("Alguno de los motivos elegidos ya no está disponible.");
  }
  const noAplica = motivos.find((m) => !isReasonAllowedFor(m.codigo, isMinor));
  if (noAplica) {
    throw AppError.badRequest(`«${noAplica.etiqueta}» no aplica para un menor de edad.`);
  }
  const otro = motivos.find((m) => m.requiere_texto);
  if (otro && !libre) {
    throw AppError.badRequest(`Describe el motivo de la consulta para «${otro.etiqueta}».`);
  }
  // Con motivos del catálogo el texto solo vale con «Otro»: una sola fuente de verdad.
  return { motivoIds: ids, motivo: otro ? libre : null };
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
