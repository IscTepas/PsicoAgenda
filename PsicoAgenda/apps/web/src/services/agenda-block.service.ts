import type { AgendaBlock } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

/**
 * La API serializa las fechas como cadenas ISO y el resto de la interfaz trabaja
 * con `Date`; cada respuesta se revive antes de salir de este módulo.
 */
interface SerializedAgendaBlock
  extends Omit<AgendaBlock, "startTime" | "endTime" | "createdAt" | "updatedAt"> {
  startTime: string
  endTime: string
  createdAt: string
  updatedAt: string
}

function reviveBlock(raw: SerializedAgendaBlock): AgendaBlock {
  return {
    ...raw,
    startTime: new Date(raw.startTime),
    endTime: new Date(raw.endTime),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  }
}

export interface CreateAgendaBlockPayload {
  startTime: Date
  endTime: Date
  allDay?: boolean
  reason?: string
}

export const agendaBlockService = {
  async list(params: { from: Date; to: Date }): Promise<AgendaBlock[]> {
    const query = new URLSearchParams({
      from: params.from.toISOString(),
      to: params.to.toISOString(),
    })

    const rows = await apiFetch<SerializedAgendaBlock[]>(`/bloqueos?${query.toString()}`)
    return rows.map(reviveBlock)
  },

  async create(payload: CreateAgendaBlockPayload): Promise<AgendaBlock> {
    const created = await apiFetch<SerializedAgendaBlock>("/bloqueos", {
      method: "POST",
      body: {
        startTime: payload.startTime.toISOString(),
        endTime: payload.endTime.toISOString(),
        allDay: payload.allDay ?? false,
        reason: payload.reason,
      },
    })

    return reviveBlock(created)
  },

  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/bloqueos/${id}`, { method: "DELETE" })
  },
}
