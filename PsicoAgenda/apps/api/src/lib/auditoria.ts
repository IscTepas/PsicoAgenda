import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";

/** Quién hizo la acción y desde dónde; los controladores lo arman con `contextoDe(req)`. */
export interface ContextoAuditoria {
  auth: AuthenticatedUser;
  ip?: string;
}

/** IP real del cliente: en Vercel llega en `x-forwarded-for` (la primera es la del cliente). */
export function contextoDe(req: Request & { auth?: AuthenticatedUser }): ContextoAuditoria {
  const reenviada = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(",")[0]?.trim() || req.ip || undefined;
  return { auth: req.auth!, ip };
}

/**
 * Bitácora de auditoría del expediente (NOM-024): quién, qué, sobre qué registro,
 * desde qué IP y a qué hora del servidor. La tabla es de solo inserción (trigger
 * `trg_auditoria_solo_insercion`).
 */
export async function auditar(
  ctx: ContextoAuditoria | undefined,
  accion: string,
  entidad: string,
  entidadId: string | null,
  detalle?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  // Sin contexto (procesos internos o pruebas que no lo pasan) no hay a quién atribuirlo.
  if (!ctx) return;
  await tx.registros_auditoria.create({
    data: {
      id: randomUUID(),
      usuario_id: ctx.auth.id,
      accion,
      entidad,
      entidad_id: entidadId,
      detalle,
      ip: ctx.ip ?? null,
    },
  });
}
