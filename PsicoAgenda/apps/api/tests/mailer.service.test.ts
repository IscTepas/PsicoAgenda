import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarCodigoRegistro } from "@/services/mailer.service";

const { config, sendMail } = vi.hoisted(() => ({
  config: {
    gmailUser: "salida@psicoagenda.app",
    gmailAppPassword: "contraseña-de-aplicación",
    isProduction: false,
  },
  sendMail: vi.fn(),
}));

// Config y transporte interceptados: la prueba nunca abre una conexión SMTP.
vi.mock("@/config", () => ({ config }));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

const EMAIL = "persona@ejemplo.com";
const CODIGO = "042137";

interface MensajeSalida {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

const mensajeEnviado = (): MensajeSalida => sendMail.mock.calls[0]?.[0] as MensajeSalida;

beforeEach(() => {
  config.gmailUser = "salida@psicoagenda.app";
  config.gmailAppPassword = "contraseña-de-aplicación";
  config.isProduction = false;
  sendMail.mockReset();
  sendMail.mockResolvedValue({ messageId: "ok" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enviarCodigoRegistro", () => {
  it("entrega el mismo código generado al destinatario correcto", async () => {
    await enviarCodigoRegistro(EMAIL, CODIGO);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mensaje = mensajeEnviado();
    expect(mensaje.to).toBe(EMAIL);
    expect(mensaje.from).toContain(config.gmailUser);
    expect(mensaje.subject).toContain("código de verificación");
    expect(mensaje.html).toContain(CODIGO);
    expect(mensaje.text).toContain(CODIGO);
  });

  it("no filtra el código en el asunto ni a otros destinatarios", async () => {
    await enviarCodigoRegistro(EMAIL, CODIGO);

    const mensaje = mensajeEnviado();
    expect(mensaje.subject).not.toContain(CODIGO);
    expect(sendMail.mock.calls[0]).toHaveLength(1);
  });

  it("convierte un fallo de SMTP en 503 con mensaje propio", async () => {
    sendMail.mockRejectedValueOnce(new Error("SMTP connection lost"));
    const errorConsola = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(enviarCodigoRegistro(EMAIL, CODIGO)).rejects.toMatchObject({
      statusCode: 503,
      code: "MAILER_ERROR",
    });
    expect(errorConsola).toHaveBeenCalled();
  });

  it("sin credenciales en desarrollo escribe el código en consola y no envía", async () => {
    config.gmailUser = "";
    config.gmailAppPassword = "";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(enviarCodigoRegistro(EMAIL, CODIGO)).resolves.toBeUndefined();

    expect(sendMail).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining(CODIGO));
  });

  it("sin credenciales en producción rechaza en lugar de fingir un envío", async () => {
    config.gmailUser = "";
    config.gmailAppPassword = "";
    config.isProduction = true;

    await expect(enviarCodigoRegistro(EMAIL, CODIGO)).rejects.toMatchObject({
      statusCode: 503,
      code: "MAILER_NO_CONFIGURADO",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
