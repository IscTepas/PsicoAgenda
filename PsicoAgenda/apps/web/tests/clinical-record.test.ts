import { beforeEach, describe, expect, it, vi } from "vitest"

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiFetch }
})

import { clinicalRecordService } from "@/services/clinical-record.service"

beforeEach(() => vi.clearAllMocks())

describe("clinicalRecordService", () => {
  it("revive las fechas del expediente y del tutor que firmó", async () => {
    apiFetch.mockResolvedValue({
      id: "r-1",
      patientId: "p-1",
      openedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      status: "active",
      consents: [
        {
          id: "c-1",
          patientId: "p-1",
          signedAt: "2026-02-01T00:00:00.000Z",
          document: "Consentimiento informado",
          legalGuardianId: "t-1",
          legalGuardian: {
            id: "t-1",
            name: "María Ejemplo",
            createdAt: "2025-01-01T00:00:00.000Z",
          },
          status: "signed",
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    })

    const record = await clinicalRecordService.get("p-1")

    expect(record.openedAt).toBeInstanceOf(Date)
    expect(record.consents[0]?.signedAt).toBeInstanceOf(Date)
    expect(record.consents[0]?.legalGuardian?.createdAt).toBeInstanceOf(Date)
    expect(record.consents[0]?.legalGuardian?.name).toBe("María Ejemplo")
  })

  it("tolera una respuesta antigua sin consentimientos", async () => {
    apiFetch.mockResolvedValue({
      id: "r-1",
      patientId: "p-1",
      openedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      status: "active",
    })

    const record = await clinicalRecordService.get("p-1")

    expect(record.consents).toEqual([])
  })
})
