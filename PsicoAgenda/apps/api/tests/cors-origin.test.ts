import { describe, expect, it } from "vitest";
import { origenPermitido } from "@/lib/cors-origin";

const PRODUCCION = "https://psicoagenda.vercel.app";
const PREVIEW = "https://psicoagenda-web-git-rama-ana.vercel.app";

describe("origenPermitido", () => {
  it("acepta la coincidencia exacta de la lista", () => {
    expect(origenPermitido(PRODUCCION, [PRODUCCION])).toBe(true);
  });

  it("rechaza un origen que no está en la lista", () => {
    expect(origenPermitido("https://otro-sitio.com", [PRODUCCION])).toBe(false);
  });

  it("acepta los preview deployments con comodín, solo con el guion del patrón", () => {
    const patrones = [PRODUCCION, "https://psicoagenda-web-*.vercel.app"];

    expect(origenPermitido(PREVIEW, patrones)).toBe(true);
    // El comodín no es "opcional": un origen sin el guion no entra por el patrón.
    expect(
      origenPermitido("https://psicoagenda-web.vercel.app", ["https://psicoagenda-web-*.vercel.app"]),
    ).toBe(false);
  });

  it("no deja que el comodín cruce a otro dominio", () => {
    // Sin anclar el patrón, `psicoagenda-web-*.vercel.app.alatacante.com` pasaría.
    const patrones = ["https://psicoagenda-web-*.vercel.app"];

    expect(origenPermitido("https://psicoagenda-web-x.vercel.app.alatacante.com", patrones)).toBe(
      false,
    );
  });

  it("escapa los puntos del dominio en vez de tratarlos como comodín", () => {
    expect(origenPermitido("https://psicoagendaXvercel.app", [PRODUCCION])).toBe(false);
  });

  it("permite la petición sin origen (servidor a servidor, curl, el cron)", () => {
    // El navegador siempre envía `Origin`; no puede omitirlo para saltarse CORS.
    expect(origenPermitido(undefined, [PRODUCCION])).toBe(true);
  });

  it("permite cualquier origen cuando la entrada es `*`", () => {
    expect(origenPermitido("https://cualquiera.com", ["*"])).toBe(true);
  });
});
