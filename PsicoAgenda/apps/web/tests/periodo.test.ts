import { describe, expect, it } from "vitest"
import { periodoAnterior } from "../src/lib/periodo"

describe("período anterior", () => {
  it("un mes completo se compara con el mes completo anterior", () => {
    expect(periodoAnterior("2026-11-01", "2026-11-30")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" })
    expect(periodoAnterior("2026-03-01", "2026-03-31")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" })
    expect(periodoAnterior("2026-01-01", "2026-12-31")).toEqual({ desde: "2025-01-01", hasta: "2025-12-31" })
  })

  it("un rango suelto se compara con los mismos días justo antes", () => {
    expect(periodoAnterior("2026-11-10", "2026-11-19")).toEqual({ desde: "2026-10-31", hasta: "2026-11-09" })
  })
})
