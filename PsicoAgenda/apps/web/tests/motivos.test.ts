import { UserRole } from "@psicoagenda/shared"
import { describe, expect, it } from "vitest"

import { navItemsForRole } from "@/lib/navigation"
import { errorDeMotivo } from "@/services/consultation-reason.service"

const OTRO = { label: "Otro", requiresText: true }
const ANSIEDAD = { label: "Ansiedad", requiresText: false }

describe("errorDeMotivo", () => {
  it("no deja enviar «Otro» vacío", () => {
    expect(errorDeMotivo(OTRO, "   ", true)).toMatch(/Describe/)
    expect(errorDeMotivo(OTRO, "Insomnio", true)).toBeNull()
  })

  it("un motivo normal no pide texto", () => {
    expect(errorDeMotivo(ANSIEDAD, "", true)).toBeNull()
  })

  it("en un alta el motivo es obligatorio; al editar una cita histórica no", () => {
    expect(errorDeMotivo(undefined, "", true)).toMatch(/Elige/)
    expect(errorDeMotivo(undefined, "", false)).toBeNull()
  })
})

describe("acceso al catálogo", () => {
  it("solo el administrador ve la pantalla de motivos", () => {
    const tiene = (role: UserRole) => navItemsForRole(role).some((item) => item.href === "/motivos")
    expect(tiene(UserRole.ADMIN)).toBe(true)
    expect(tiene(UserRole.PSYCHOLOGIST)).toBe(false)
    expect(tiene(UserRole.PATIENT)).toBe(false)
  })
})
