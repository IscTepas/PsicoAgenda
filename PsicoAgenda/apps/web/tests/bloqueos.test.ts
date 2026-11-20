import { describe, expect, it } from "vitest"
import { tramosContiguos } from "../src/lib/bloqueos"

describe("tramosContiguos", () => {
  it("une franjas seguidas y separa las que dejan hueco", () => {
    expect(
      tramosContiguos([
        { startTime: "12:00", endTime: "13:00" },
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
      ]),
    ).toEqual([
      { startTime: "09:00", endTime: "11:00" },
      { startTime: "12:00", endTime: "13:00" },
    ])
  })

  it("sin franjas no hay tramos", () => {
    expect(tramosContiguos([])).toEqual([])
  })
})
