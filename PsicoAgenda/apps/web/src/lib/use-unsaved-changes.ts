"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Mientras haya cambios sin guardar, intercepta la salida de la pantalla:
 * - cerrar o recargar la pestaña: el aviso nativo del navegador;
 * - un enlace interno (barra lateral, botones con `Link`): deja el destino en
 *   `pendingHref` para que la pantalla pregunte antes de navegar.
 *
 * shortcut: el botón "atrás" del navegador no se intercepta (App Router no da cómo); si molesta, guardar un borrador.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    if (!isDirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()

    // En captura, antes que el `onClick` de `Link`: así la navegación del cliente nunca arranca.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.("a[href]")
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return
      }
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return

      event.preventDefault()
      event.stopPropagation()
      setPendingHref(`${url.pathname}${url.search}${url.hash}`)
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [isDirty])

  return {
    pendingHref,
    stay: () => setPendingHref(null),
    leave: () => {
      if (pendingHref) router.push(pendingHref)
      setPendingHref(null)
    },
  }
}
