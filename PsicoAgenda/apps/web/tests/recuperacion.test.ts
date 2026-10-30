import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api-client"

const { apiFetch, resetPasswordForEmail } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiFetch }
})
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail } }),
}))

import {
  esEnlaceInvalido,
  mensajeDeRecuperacion,
  recuperacionService,
} from "@/services/recuperacion.service"

beforeEach(() => vi.clearAllMocks())

describe("recuperacionService", () => {
  it("pide el enlace a la API y no a Supabase", async () => {
    apiFetch.mockResolvedValue({ ok: true })

    await recuperacionService.solicitar("ana@ejemplo.com")

    expect(apiFetch).toHaveBeenCalledWith("/auth/recuperacion/solicitar", {
      method: "POST",
      body: { email: "ana@ejemplo.com" },
    })
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it("confirma con el token del enlace y la contraseña nueva", async () => {
    apiFetch.mockResolvedValue({ ok: true })

    await recuperacionService.confirmar("tok", "NuevaClave1")

    expect(apiFetch).toHaveBeenCalledWith("/auth/recuperacion/confirmar", {
      method: "POST",
      body: { token: "tok", password: "NuevaClave1" },
    })
  })
})

describe("errores", () => {
  it("un token vencido o usado lleva a la pantalla de enlace inválido", () => {
    expect(esEnlaceInvalido(new ApiError(400, "TOKEN_INVALIDO", "x"))).toBe(true)
    expect(esEnlaceInvalido(new ApiError(400, "VALIDATION_ERROR", "x"))).toBe(false)
  })

  it("el exceso de solicitudes tiene su propio mensaje", () => {
    expect(mensajeDeRecuperacion(new ApiError(429, "RATE_LIMIT", "x"))).toMatch(/espera/i)
    expect(mensajeDeRecuperacion(new Error("red"))).toMatch(/inténtalo/i)
  })
})
