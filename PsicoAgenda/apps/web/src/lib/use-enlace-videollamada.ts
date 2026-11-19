"use client"

import { useQuery } from "@tanstack/react-query"
import { UserRole } from "@psicoagenda/shared"
import { useSession } from "@/lib/use-session"
import { patientService, psychologistService } from "@/services"

/**
 * El enlace fijo de videollamada de la psicóloga: el suyo si la sesión es de
 * psicóloga, el de su psicóloga si es de paciente. `undefined` si no lo ha configurado.
 */
export function useEnlaceVideollamada(): string | undefined {
  const { user } = useSession()
  const esPsicologa = user?.role === UserRole.PSYCHOLOGIST
  const esPaciente = user?.role === UserRole.PATIENT

  // Misma clave que Ajustes de citas: al guardar el enlace ahí, se actualiza aquí.
  const propio = useQuery({
    queryKey: ["psicologo", "yo"],
    queryFn: () => psychologistService.getMe(),
    enabled: esPsicologa,
    staleTime: 5 * 60_000,
  })
  const deSuPsicologa = useQuery({
    queryKey: ["psicologo", "del-paciente"],
    queryFn: async () => {
      const yo = await patientService.getMe()
      return yo.psychologistId ? psychologistService.getById(yo.psychologistId) : null
    },
    enabled: esPaciente,
    staleTime: 5 * 60_000,
  })

  return (esPsicologa ? propio.data : deSuPsicologa.data)?.videoCallUrl
}
