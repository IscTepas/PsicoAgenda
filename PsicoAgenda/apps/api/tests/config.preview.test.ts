import { afterEach, describe, expect, it, vi } from "vitest";

const cargar = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/config");
};

afterEach(() => vi.unstubAllEnvs());

describe("candado de previews", () => {
  it("un preview sin base aislada no arranca", async () => {
    await expect(cargar({ VERCEL_ENV: "preview", ENTORNO_BD: "" })).rejects.toThrow(/ENTORNO_BD=preview/);
  });

  it("un preview marcado como aislado arranca", async () => {
    await expect(cargar({ VERCEL_ENV: "preview", ENTORNO_BD: "preview" })).resolves.toBeDefined();
  });

  it("producción no necesita la marca", async () => {
    await expect(cargar({ VERCEL_ENV: "production", ENTORNO_BD: "" })).resolves.toBeDefined();
  });
});
