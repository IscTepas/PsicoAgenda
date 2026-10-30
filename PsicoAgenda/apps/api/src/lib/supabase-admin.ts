import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/config";
import { AppError } from "@/utils/app-error";

/**
 * Acceso administrativo a Supabase Auth, con la service role key.
 *
 * Esta es la ÚNICA puerta del proyecto para crear cuentas ahora que el alta ya
 * no sale desde el navegador. Vive exclusivamente en `apps/api/src/config`;
 * `apps/web` jamás la importa (está prohibido por la propia configuración de
 * Next: solo puede importar variables `NEXT_PUBLIC_*`).
 *
 * Se crea perezosamente para que los tests puedan interceptar
 * `@supabase/supabase-js` antes de la primera llamada.
 */

let admin: SupabaseClient | null = null;

const obtenerSupabaseAdmin = (): SupabaseClient => {
  if (!config.supabaseServiceRoleKey) {
    throw new AppError(
      503,
      "El servicio de registro no está disponible. Intenta de nuevo más tarde.",
      "REGISTRO_NO_CONFIGURADO",
    );
  }
  if (!admin) {
    admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
};

interface ErrorAdmin {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * ¿Ya existe una identidad con este correo?
 *
 * El cliente JS no ofrece "buscar por correo" (`listUsers` solo pagina), así
 * que se consulta el endpoint admin de GoTrue con `filter` — coincidencia
 * parcial — y se compara exacto aquí: `filter=ana@x.com` también devolvería
 * `xana@x.com`, que no nos interesa rechazar.
 */
export async function existeCuenta(email: string): Promise<boolean> {
  if (!config.supabaseServiceRoleKey) {
    throw new AppError(
      503,
      "El servicio de registro no está disponible. Intenta de nuevo más tarde.",
      "REGISTRO_NO_CONFIGURADO",
    );
  }

  const buscado = email.trim().toLowerCase();
  let respuesta: Response;

  try {
    respuesta = await fetch(
      `${config.supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(buscado)}`,
      {
        headers: {
          apikey: config.supabaseServiceRoleKey,
          Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        },
      },
    );
  } catch (error) {
    console.error("[registro] Falló la consulta de cuenta existente:", error);
    throw new AppError(
      503,
      "No se pudo verificar el estado de la cuenta. Intenta de nuevo más tarde.",
      "AUTH_NO_DISPONIBLE",
    );
  }

  if (!respuesta.ok) {
    console.error(`[registro] La consulta de cuenta existente respondió ${respuesta.status}`);
    throw new AppError(
      503,
      "No se pudo verificar el estado de la cuenta. Intenta de nuevo más tarde.",
      "AUTH_NO_DISPONIBLE",
    );
  }

  const cuerpo = (await respuesta.json()) as { users?: Array<{ email?: string | null }> };
  return (cuerpo.users ?? []).some(
    (usuario) => (usuario.email ?? "").trim().toLowerCase() === buscado,
  );
}

/** Fija una contraseña nueva a una cuenta existente (recuperación por enlace). */
export async function actualizarContrasena(userId: string, password: string): Promise<void> {
  const { error } = await obtenerSupabaseAdmin().auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("[recuperacion] Falló auth.admin.updateUserById:", error);
    throw new AppError(
      503,
      "No se pudo guardar la contraseña. Intenta de nuevo más tarde.",
      "AUTH_ERROR",
    );
  }
}

/**
 * Crea la cuenta YA CONFIRMADA (el código de correo se validó en la API, no
 * hace falta que Supabase reenvíe nada). Los metadatos disparan los triggers
 * `seed_business_role` y `handle_new_user`, que arman el perfil y el
 * expediente del paciente.
 */
export async function crearCuentaVerificada(
  email: string,
  password: string,
  userMetadata: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data, error } = await obtenerSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    const adminError = error as ErrorAdmin;
    // Paridad con el mensaje del signUp actual de la web.
    if (
      adminError.code === "user_already_exists" ||
      adminError.status === 409 ||
      adminError.status === 422
    ) {
      throw AppError.conflict("Ya existe una cuenta registrada con este correo electrónico.");
    }
    console.error("[registro] Falló auth.admin.createUser:", error);
    throw new AppError(
      503,
      "No se pudo crear la cuenta. Intenta de nuevo más tarde.",
      "AUTH_ERROR",
    );
  }

  if (!data.user) {
    throw new AppError(503, "No se pudo crear la cuenta. Intenta de nuevo más tarde.", "AUTH_ERROR");
  }
  return { id: data.user.id };
}
