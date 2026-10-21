/**
 * Formato de los teléfonos locales: 10 dígitos visibles como `555-123-4567`.
 * Vive fuera de `registro.service` para que el registro y el perfil compartan
 * exactamente la misma máscara y normalización.
 */

/** Dígitos de un teléfono local (formato visible `555-123-4567`). */
export const DIGITOS_TELEFONO = 10;

/**
 * Deja un teléfono en el formato visible `555-123-4567`: descarta todo lo que
 * no sea dígito, recorta a 10 y agrupa 3-3-4. Se aplica al escribir y al pegar.
 */
export function formatearTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, DIGITOS_TELEFONO);
  const grupos = [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, DIGITOS_TELEFONO)];
  return grupos.filter((grupo) => grupo.length > 0).join("-");
}

/**
 * Formatea un teléfono pegado. Si trae lada o más de 10 dígitos se queda con
 * los últimos 10: `+52 55 1234 5678` → `551-234-5678`.
 */
export function formatearTelefonoPegado(texto: string): string {
  const digitos = texto.replace(/\D/g, "");
  const ultimos = digitos.length > DIGITOS_TELEFONO ? digitos.slice(-DIGITOS_TELEFONO) : digitos;
  return formatearTelefono(ultimos);
}

/** Cuenta solo dígitos, para validar sin depender de los guiones. */
export function contarDigitosTelefono(valor: string): number {
  return valor.replace(/\D/g, "").length;
}
