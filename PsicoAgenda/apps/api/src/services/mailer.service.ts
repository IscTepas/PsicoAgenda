import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { APP_NAME } from "@psicoagenda/shared";
import { config } from "@/config";
import { AppError } from "@/utils/app-error";

/**
 * Envío de correo del registro por SMTP de Gmail (contraseña de aplicación).
 *
 * Aislado a propósito: si algún día se migra a Resend u otro proveedor, solo
 * cambian las variables de entorno y la implementación interna de este
 * módulo — las rutas y el servicio de códigos no se enteran.
 *
 * Sin credenciales en producción la configuración ya abortó el arranque; aquí
 * queda la doble red por si acaso. En desarrollo el código va a la consola de
 * la API para poder probar el flujo completo sin bandeja real.
 */

const ASUNTO = `${APP_NAME}: tu código de verificación`;
const VALIDEZ_MINUTOS = 10;

let transporte: Transporter | null = null;

const obtenerTransporte = (): Transporter => {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: config.gmailUser,
        pass: config.gmailAppPassword,
      },
    });
  }
  return transporte;
};

const plantilla = (codigo: string): { html: string; text: string } => ({
  text: [
    `Tu código de verificación de ${APP_NAME} es: ${codigo}`,
    "",
    `Válido durante ${VALIDEZ_MINUTOS} minutos. Si no solicitaste este registro,`,
    "ignora este mensaje.",
  ].join("\n"),
  html: `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">${APP_NAME}</h1>
      <p style="font-size: 15px;">
        Usa el siguiente código para confirmar tu correo electrónico:
      </p>
      <p style="font-size: 32px; letter-spacing: 8px; font-weight: bold; text-align: center;
                background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
        ${codigo}
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        Válido durante ${VALIDEZ_MINUTOS} minutos. Si no solicitaste este registro, ignora este
        mensaje: nadie podrá crear una cuenta con tu correo sin este código.
      </p>
    </div>
  `,
});

/**
 * Correo de una notificación de cita. Sin credenciales en desarrollo se
 * escribe en la consola; en producción lanza para que el despachador marque
 * la notificación como fallida y la reintente.
 */
export async function enviarCorreoNotificacion(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!config.gmailUser || !config.gmailAppPassword) {
    if (!config.isProduction) {
      console.info(`[mailer][desarrollo] Correo para ${params.to}: ${params.subject}\n${params.text}`);
      return;
    }
    throw new Error("El servicio de correo no está configurado");
  }

  await obtenerTransporte().sendMail({
    from: `"${APP_NAME}" <${config.gmailUser}>`,
    ...params,
  });
}

/**
 * Envía el código de 6 dígitos a la persona que se registró.
 *
 * Lanza `AppError(503)` si el correo no pudo salir; quien llama decide si
 * cancela el código generado (no tiene sentido exigir un código que jamás
 * llegó).
 */
export async function enviarCodigoRegistro(email: string, codigo: string): Promise<void> {
  if (!config.gmailUser || !config.gmailAppPassword) {
    if (!config.isProduction) {
      console.info(`[mailer][desarrollo] Código de registro para ${email}: ${codigo}`);
      return;
    }
    throw new AppError(
      503,
      "El servicio de correo no está disponible. Intenta de nuevo más tarde.",
      "MAILER_NO_CONFIGURADO",
    );
  }

  try {
    await obtenerTransporte().sendMail({
      from: `"${APP_NAME}" <${config.gmailUser}>`,
      to: email,
      subject: ASUNTO,
      ...plantilla(codigo),
    });
  } catch (error) {
    console.error("[mailer] Falló el envío del código de registro:", error);
    throw new AppError(
      503,
      "No se pudo enviar el código de verificación. Intenta de nuevo más tarde.",
      "MAILER_ERROR",
    );
  }
}
