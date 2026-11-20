import { createHash } from "node:crypto";

/**
 * Sello de integridad de las notas y de la historia clínica (NOM-024): SHA-256 de
 * `contenido ␞ cédula ␞ paciente_id ␞ hora del servidor (ISO)`. El contenido son
 * los campos unidos con ␟. Si alguien cambia una letra, el sello ya no coincide.
 *
 * La migración `20261120000000_nom004_expediente` sella las notas viejas con esta
 * misma fórmula en SQL: si se cambia aquí, hay que cambiarla allá.
 */
const SEP_CAMPO = String.fromCharCode(31);
const SEP_PARTE = String.fromCharCode(30);

export function sellar(campos: Array<string | null | undefined>, cedula: string, pacienteId: string, en: Date): string {
  const contenido = campos.map((c) => c ?? "").join(SEP_CAMPO);
  return createHash("sha256").update([contenido, cedula, pacienteId, en.toISOString()].join(SEP_PARTE), "utf8").digest("hex");
}

/** Campos de una nota que entran al sello, en el mismo orden que la migración. */
export function camposDeNota(nota: {
  tipo: string;
  fecha_sesion: Date;
  notas_sesion: string;
  objetivos_trabajados: string | null;
  plan_proxima_sesion: string | null;
  estado_general: string | null;
  referido_a: string | null;
  motivo_referencia: string | null;
  motivo_egreso: string | null;
  resumen_egreso: string | null;
  nota_padre_id: string | null;
}): string[] {
  return [
    nota.tipo,
    nota.fecha_sesion.toISOString(),
    nota.notas_sesion,
    nota.objetivos_trabajados ?? "",
    nota.plan_proxima_sesion ?? "",
    nota.estado_general ?? "",
    nota.referido_a ?? "",
    nota.motivo_referencia ?? "",
    nota.motivo_egreso ?? "",
    nota.resumen_egreso ?? "",
    nota.nota_padre_id ?? "",
  ];
}
