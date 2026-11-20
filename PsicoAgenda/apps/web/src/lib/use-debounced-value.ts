"use client"

import { useEffect, useState } from "react"

/** El valor, pero solo cuando lleva `ms` sin cambiar: filtrar espera a que se deje de teclear. */
export function useDebouncedValue<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}
