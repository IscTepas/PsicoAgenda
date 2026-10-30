import type { Request, RequestHandler } from "express";
import {
  esMenorDeEdad,
  registroPacienteSchema,
  verificarCodigoRegistroSchema,
  UserRole,
  type RegistroPaciente,
} from "@psicoagenda/shared";
import {
  CODIGO_TTL_SECONDS,
  REENVIO_COOLDOWN_SECONDS,
  consumirCodigo,
  generarCodigo,
  limitarSolicitudesPorIp,
  verificarCodigo,
} from "@/services/codigo.service";
import { enviarCodigoRegistro } from "@/services/mailer.service";
import { crearCuentaVerificada, existeCuenta } from "@/lib/supabase-admin";
import { AppError } from "@/utils/app-error";

/**
 * Registro de usuario en dos pasos:
 *
 * 1. `pre-registro`: valida el payload, rate-limit, descarta correos ya
 *    registrados, genera el código y lo envía. NO crea nada en Auth ni en la
 *    base de datos.
 * 2. `verificar-codigo`: valida el código contra el hash y recién entonces
 *    crea la cuenta ya confirmada (`email_confirm: true`); los triggers
 *    existentes arman el perfil y el expediente. Si falla, no quedó ningún
 *    residuo: el código sigue vivo hasta su TTL y la BD intacta.
 */

/** IP del cliente: el primer salto de `X-Forwarded-For` si hubo proxy (en
 * desarrollo las llamadas pasan por el rewrite de Next.js y `req.ip` sería el
 * mismo para todas las personas), o la conexión directa. */
export const origenDe = (req: Request): string => {
  const encabezado = req.headers["x-forwarded-for"];
  const primero = Array.isArray(encabezado) ? encabezado[0] : encabezado;
  return primero?.split(",")[0]?.trim() || req.ip || "desconocida";
};

/**
 * Metadatos tal como los espera `handle_new_user` (mismas claves que enviaba
 * el formulario hasta ahora). `is_minor` se deriva de la fecha en el servidor:
 * el único dato del cliente en el que se confía es el que ya validó zod.
 */
const construirMetadata = (payload: RegistroPaciente): Record<string, unknown> => {
  const menor = esMenorDeEdad(payload.birth_date);
  return {
    name: payload.name,
    phone: payload.phone,
    role: UserRole.PATIENT,
    birth_date: payload.birth_date,
    gender: payload.gender ?? "",
    address: payload.address ?? "",
    is_minor: menor,
    emergency_contact: {
      name: payload.emergency_contact.name,
      phone: payload.emergency_contact.phone,
      relationship: payload.emergency_contact.relationship ?? "",
    },
    ...(menor && payload.guardian
      ? {
          guardian: {
            name: payload.guardian.name,
            phone: payload.guardian.phone,
            relationship: payload.guardian.relationship ?? "",
          },
        }
      : {}),
  };
};

export const preRegistroController: RequestHandler = async (req, res, next) => {
  try {
    const payload = registroPacienteSchema.parse(req.body);

    // El control de abuso por origen va primero: protege al mailer y a
    // Supabase Auth antes de gastar una sola llamada externa.
    await limitarSolicitudesPorIp(origenDe(req));

    // Paridad con el signUp actual: mismo mensaje cuando la cuenta ya existe.
    if (await existeCuenta(payload.email)) {
      throw AppError.conflict("Ya existe una cuenta registrada con este correo electrónico.");
    }

    const codigo = await generarCodigo(payload.email);
    try {
      await enviarCodigoRegistro(payload.email, codigo);
    } catch (error) {
      // El correo no salió: el código no le sirve a nadie. Lo retiramos y
      // liberamos el cooldown para que la persona pueda reintentar ya.
      await consumirCodigo(payload.email).catch(() => undefined);
      throw error;
    }

    res.status(201).json({
      ok: true,
      expiresInSeconds: CODIGO_TTL_SECONDS,
      resendCooldownSeconds: REENVIO_COOLDOWN_SECONDS,
    });
  } catch (error) {
    next(error);
  }
};

export const verificarCodigoController: RequestHandler = async (req, res, next) => {
  try {
    const payload = verificarCodigoRegistroSchema.parse(req.body);

    // Valida contra el hash (con intentos y expiración) SIN consumir el
    // código: si `createUser` falla por un problema transitorio, la persona
    // conserva su código y puede reintentar dentro de la ventana.
    await verificarCodigo(payload.email, payload.codigo);

    const usuario = await crearCuentaVerificada(
      payload.email,
      payload.password,
      construirMetadata(payload),
    );

    // El alta ya ocurrió: si la cache no respondiera, el TTL de 10 minutos
    // liquida lo que quede — nunca se aborta un registro ya creado.
    await consumirCodigo(payload.email).catch((error) => {
      console.error("[registro] No se pudieron limpiar las claves del código:", error);
    });

    res.status(201).json({ ok: true, user: { id: usuario.id, email: payload.email } });
  } catch (error) {
    next(error);
  }
};
