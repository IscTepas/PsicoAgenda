import { esMenorDeEdad, type RegistroPaciente } from "@psicoagenda/shared"
import { ApiError, apiFetch } from "@/lib/api-client"
import { createClient } from "@/lib/supabase/client"

/**
 * Alta de paciente en dos pasos.
 *
 * La cuenta NO se crea con `auth.signUp` desde el navegador: primero la API
 * genera un código de 6 dígitos, lo manda por correo y solo cuando la persona
 * lo escribe crea la identidad (ya confirmada) y el expediente. Hasta ese
 * momento no existe nada en la base de datos.
 */

export const RUTA_TRAS_REGISTRO = "/dashboard"

/** Campos del formulario que alimentan el payload del pre-registro. */
export interface DatosRegistro {
  email: string
  password: string
  name: string
  phone: string
  birthDate?: string
  gender?: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  guardianName?: string
  guardianPhone?: string
  guardianRelationship?: string
}

export interface RespuestaPreRegistro {
  ok: true
  expiresInSeconds: number
  resendCooldownSeconds: number
}

export interface CuentaVerificada {
  id: string
  email: string
}

/**
 * Arma el payload que espera la API (`registroPacienteSchema`). Nada de
 * `role` ni de `is_minor`: el rol lo fija el servidor y la minoría se deriva
 * de la fecha de nacimiento. El tutor solo viaja si la fecha resulta en menor
 * — con `esMenorDeEdad`, la misma función que usa el servidor, para no mandar
 * campos que no correspondan.
 */
export function construirPayloadRegistro(values: DatosRegistro): RegistroPaciente {
  const menor = esMenorDeEdad(values.birthDate ?? "")

  return {
    email: values.email.trim().toLowerCase(),
    password: values.password,
    name: values.name,
    phone: values.phone,
    birth_date: values.birthDate ?? "",
    gender: values.gender,
    address: values.address,
    emergency_contact: {
      name: values.emergencyContactName ?? "",
      phone: values.emergencyContactPhone ?? "",
      relationship: values.emergencyContactRelationship,
    },
    ...(menor
      ? {
          guardian: {
            name: values.guardianName ?? "",
            phone: values.guardianPhone ?? "",
            relationship: values.guardianRelationship,
          },
        }
      : {}),
  }
}

/** Segundos que la API pide esperar (cooldown o rate limit), si los informó. */
export function segundosDeEspera(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null
  const details = error.details as { retryAfterSeconds?: unknown } | undefined
  const segundos = details?.retryAfterSeconds
  return typeof segundos === "number" && Number.isFinite(segundos) ? segundos : null
}

/**
 * Mensaje para la persona a partir del error de la API. Los códigos de la API
 * son estables; los que el formulario puede mejorar (con los segundos
 * restantes, por ejemplo) se traducen aquí y el resto cae en el mensaje que ya
 * redactó el servidor.
 */
export function mensajeDeRegistro(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "COOLDOWN":
        return `Ya te enviamos un código hace poco. Espera ${segundosDeEspera(error) ?? 60} segundos antes de pedir otro.`
      case "RATE_LIMIT":
        return "Demasiadas solicitudes de registro desde tu conexión. Inténtalo de nuevo en unos minutos."
      case "CODIGO_INVALIDO":
        return "El código no es correcto. Revísalo e inténtalo de nuevo."
      case "CODIGO_EXPIRADO":
        return "El código expiró. Solicita uno nuevo."
      case "CODIGO_AGOTADO":
        return "Se agotaron los intentos para este código. Solicita uno nuevo."
      default:
        return error.message
    }
  }

  return "No se pudo conectar con el servicio de registro. Revisa tu conexión e inténtalo de nuevo."
}

/**
 * Deja un texto en forma de código de 6 dígitos.
 *
 * La persona puede copiar el código del correo (que Gmail ofrece con su propio
 * botón "Copiar código") y pegarlo en el campo. Al pegar, lo que llega puede ser
 * el código solo ("019360"), con espacios entre dígitos ("0 1 9 3 6 0") o el
 * texto del correo entero; aquí se reduce siempre a los 6 dígitos correctos.
 */
export function normalizarCodigo(texto: string): string {
  const digitos = texto.replace(/\D/g, "")
  if (digitos.length === 0) return ""
  if (digitos.length === 6) return digitos

  // Texto más largo que el código (correo completo): se busca un bloque de
  // exactamente 6 dígitos, que es como aparece el código en la plantilla.
  const bloque = texto.split(/\D+/).find((parte) => parte.length === 6)
  if (bloque) return bloque

  // Sin un bloque claro (números pegados): se rellena con los primeros dígitos.
  return digitos.slice(0, 6)
}

/**
 * Lee el código del portapapeles del navegador.
 *
 * Es el equivalente al botón "Copiar código" que Gmail muestra en el correo:
 * el correo no puede leer el portapapeles (los clientes de correo eliminan el
 * JavaScript), así que la copia la hace la persona y aquí solo se pega.
 *
 * Falla con un mensaje listo para mostrar cuando el portapapeles no está
 * disponible (contexto no seguro o navegador sin permiso), cuando se deniega
 * el permiso o cuando no hay un código en él.
 */
export async function leerCodigoDelPortapapeles(): Promise<string> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
  if (!clipboard || typeof clipboard.readText !== "function") {
    throw new Error(
      "Tu navegador no permite leer el portapapeles. Copia el código del correo y pégalo con Ctrl+V.",
    )
  }

  let texto: string
  try {
    texto = await clipboard.readText()
  } catch {
    throw new Error(
      "No se pudo leer el portapapeles. Copia el código del correo y pégalo con Ctrl+V.",
    )
  }

  const codigo = normalizarCodigo(texto)
  if (!codigo) {
    throw new Error("No encontré un código de 6 dígitos en el portapapeles.")
  }
  return codigo
}

export const registroService = {
  /** Paso 1: pide el código. No crea nada (ni cuenta ni expediente). */
  solicitarCodigo: (payload: RegistroPaciente) =>
    apiFetch<RespuestaPreRegistro>("/auth/pre-registro", {
      method: "POST",
      body: payload,
    }),

  /** Paso 2: la API valida el código y recién ahí crea la cuenta confirmada. */
  confirmarCodigo: (payload: RegistroPaciente, codigo: string) =>
    apiFetch<{ ok: true; user: CuentaVerificada }>("/auth/verificar-codigo", {
      method: "POST",
      body: { ...payload, codigo },
    }),
}

/**
 * Inicia la sesión con la cuenta recién creada. `refreshSession` deja la
 * cookie renovada para que `proxy.ts` valide la sesión antes de resolver la
 * navegación (mismo camino que sigue el formulario de acceso).
 */
export async function iniciarSesion(email: string, password: string): Promise<void> {
  const client = createClient()
  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(
      "Tu cuenta se creó correctamente, pero no pudimos iniciar sesión. Entra desde la pantalla de acceso.",
    )
  }

  await client.auth.refreshSession()
}

/**
 * Cierra el registro: confirma el código con la API, crea la sesión y navega.
 *
 * Los datos del formulario se reciben ya resueltos (no se releen del DOM), así
 * que un fallo aquí — código vencido o incorrecto — deja a la persona en la
 * pantalla del código con todo lo que escribió intacto.
 */
export async function completarRegistro(
  values: DatosRegistro,
  codigo: string,
  navegar: (ruta: string) => void,
): Promise<void> {
  const payload = construirPayloadRegistro(values)

  await registroService.confirmarCodigo(payload, codigo)
  await iniciarSesion(payload.email, values.password)
  navegar(RUTA_TRAS_REGISTRO)
}
