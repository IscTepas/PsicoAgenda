import { perfilPacienteSchema, perfilPsicologoSchema } from "@psicoagenda/shared"

export type CampoPerfil =
  | "name"
  | "phone"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "licenseNumber"
  | "specialty"

export type ErroresPerfil = Partial<Record<CampoPerfil, string>>

/**
 * Valida el perfil completo con el mismo esquema que comparte la API y devuelve un
 * mensaje por campo (el primero de cada uno), para pintarlo bajo su input.
 */
export function erroresDePerfil(esPaciente: boolean, valores: Record<string, unknown>): ErroresPerfil {
  const resultado = (esPaciente ? perfilPacienteSchema : perfilPsicologoSchema).safeParse(valores)
  const errores: ErroresPerfil = {}
  if (resultado.success) return errores
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as CampoPerfil
    errores[campo] ??= issue.message
  }
  return errores
}
