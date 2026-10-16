"use client"

import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}

/**
 * Devuelve `false` durante el render en servidor y en el primer render del
 * cliente, y `true` tras hidratar. Sirve para rendir contenido dependiente de
 * la hora/fecha solo en el cliente y evitar hydration mismatches entre la TZ
 * del servidor y la del navegador.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
