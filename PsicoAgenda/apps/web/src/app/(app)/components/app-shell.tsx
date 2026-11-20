"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { UserRole } from "@psicoagenda/shared"
import { Wordmark } from "@/components/brand/wordmark"
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg"
import { NotificationsButton } from "./campana-notificaciones"
import { ToastProvider } from "@/components/toast-provider"
import { navItemsForRole } from "@/lib/navigation"
import { borrarTodosLosBorradores } from "@/lib/borradores-bitacora"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/use-session"
import { usePendingResponses } from "@/lib/use-pending-responses"
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  Bell,
  BarChart3,
  Settings,
  ListChecks,
  CalendarCog,
  type LucideIcon,
} from "lucide-react"

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/agenda": CalendarDays,
  "/pacientes": Users,
  "/citas": CalendarCog,
  "/notificaciones": Bell,
  "/reportes": BarChart3,
  "/motivos": ListChecks,
  "/perfil": Settings,
}

const SOLO_EN_RIEL = ["/citas"]

/** Una sección queda activa también en sus subpáginas (/agenda/nueva → Agenda). */
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`))
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ShellContent>{children}</ShellContent>
    </ToastProvider>
  )
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useSession()

  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const filteredNav = React.useMemo(() => navItemsForRole(effectiveRole), [effectiveRole])
  // Lo que espera respuesta de la psicóloga se señala en "Inicio", donde se atiende.
  const { count: pendingCount } = usePendingResponses(Boolean(user) && effectiveRole === UserRole.PSYCHOLOGIST)
  const badgeOf = (href: string) => (href === "/dashboard" ? pendingCount : 0)

  const handleLogout = () => {
    borrarTodosLosBorradores()
    void logout().finally(() => router.push("/login"))
  }


  return (
    <>
      {/* Con teclado, el primer Tab ofrece saltar el menú e ir directo al contenido. */}
      <a
        href="#contenido"
        className="sr-only rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:outline-none focus:ring-3 focus:ring-ring/40"
      >
        Saltar al contenido
      </a>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera flotante: logo, secciones al centro (la pastilla sigue al cursor) y la cuenta a la derecha.
            En móvil las secciones viven en la barra inferior. */}
        {/* La franja de la cabecera no recibe clics (lo de abajo sigue usable); solo la cápsula sí.
            El degradado esconde el contenido que pasa por debajo al bajar en la página. */}
        <header className="pointer-events-none sticky top-0 z-30 print:hidden bg-gradient-to-b from-background from-60% to-transparent px-3 pb-4 pt-3 md:px-6">
          <div className="material pointer-events-auto mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-border/50 bg-background/80 pl-4 pr-2 shadow-sm backdrop-blur-xl backdrop-saturate-150">
            <Link
              href="/dashboard"
              aria-label="Inicio"
              className="flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Image src="/images/psicoagenda-icon.png" alt="" width={28} height={24} className="h-6 w-7 object-contain" priority />
              <Wordmark className="whitespace-nowrap text-[15px]" />
            </Link>

            <nav aria-label="Secciones" className="hidden min-w-0 md:block">
              <SharedLayoutBg
                className="flex-row items-center"
                inset={0}
                pillClassName="rounded-full bg-muted"
              >
                {filteredNav
                  // La campana va a la derecha, junto a cerrar sesión.
                  .filter((item) => item.href !== "/notificaciones")
                  .map((item) => {
                    const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
                    const isActive = isActivePath(pathname, item.href)
                    const badge = badgeOf(item.href)
                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          title={item.label}
                          className={cn(
                            "flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
                            isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span className="relative">
                            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                            {badge > 0 && (
                              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-700 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-background dark:bg-amber-400 dark:text-amber-950">
                                {badge}
                                <span className="sr-only"> pendientes</span>
                              </span>
                            )}
                          </span>
                          {/* Con poco ancho solo íconos; desde pantallas grandes, con su nombre. */}
                          <span className="hidden lg:inline">{item.label}</span>
                        </Link>
                      </div>
                    )
                  })}
              </SharedLayoutBg>
            </nav>

            <div className="flex shrink-0 items-center gap-1">
              <NotificationsButton className="rounded-full" />
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <LogOut className="size-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main id="contenido" tabIndex={-1} className="flex-1 scroll-mt-20 p-4 pb-24 outline-none md:px-6 md:pt-4 md:pb-8 lg:px-8">
          {children}
        </main>
      </div>

      {/* Barra inferior (móvil), material translúcido con margen para la zona segura */}
      <nav
        className="material fixed inset-x-0 bottom-0 z-40 flex print:hidden items-stretch justify-around border-t border-border/60 bg-background/80 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        aria-label="Secciones"
      >
        {/* La barra solo tiene lugar para seis: los ajustes de citas se abren desde Configuración. */}
        {filteredNav.filter((item) => !SOLO_EN_RIEL.includes(item.href)).map((item) => {
          const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
          const isActive = isActivePath(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-[color,opacity] duration-150 active:opacity-60",
                isActive ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5", isActive ? "stroke-[2.5]" : "stroke-2")} aria-hidden="true" />
                {badgeOf(item.href) > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-700 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-background dark:bg-amber-400 dark:text-amber-950">
                    {badgeOf(item.href)}
                  </span>
                )}
              </span>
              <span className="max-w-[58px] truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
