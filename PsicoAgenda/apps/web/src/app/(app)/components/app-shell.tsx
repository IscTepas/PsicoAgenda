"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { UserRole } from "@psicoagenda/shared"
import { Wordmark } from "@/components/brand/wordmark"
import { motion } from "motion/react"
import { DesktopSidebar, Sidebar, SidebarLink, useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ToastProvider } from "@/components/toast-provider"
import { navItemsForRole } from "@/lib/navigation"
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
  type LucideIcon,
} from "lucide-react"

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/agenda": CalendarDays,
  "/pacientes": Users,
  "/notificaciones": Bell,
  "/reportes": BarChart3,
  "/motivos": ListChecks,
  "/perfil": Settings,
}

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PSYCHOLOGIST]: "Psicólogo/a",
  [UserRole.PATIENT]: "Paciente",
  [UserRole.ADMIN]: "Administrador",
}

function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return initials || "?"
}

/** Una sección queda activa también en sus subpáginas (/agenda/nueva → Agenda). */
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`))
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {/* Sidebar de Aceternity: se abre al pasar el mouse (o al enfocarla con el teclado). */}
      <Sidebar>
        <ShellContent>{children}</ShellContent>
      </Sidebar>
    </ToastProvider>
  )
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, logout } = useSession()
  const { open } = useSidebar()

  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const filteredNav = React.useMemo(() => navItemsForRole(effectiveRole), [effectiveRole])
  // Lo que espera respuesta de la psicóloga se señala en "Notificaciones", donde se atiende.
  const { count: pendingCount } = usePendingResponses(Boolean(user) && effectiveRole === UserRole.PSYCHOLOGIST)
  const badgeOf = (href: string) => (href === "/notificaciones" ? pendingCount : 0)

  const handleLogout = () => {
    void logout().finally(() => router.push("/login"))
  }

  const displayName = user?.name || "Tu cuenta"

  return (
    <>
      {/* Con teclado, el primer Tab ofrece saltar el menú e ir directo al contenido. */}
      <a
        href="#contenido"
        className="sr-only rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:outline-none focus:ring-3 focus:ring-ring/40"
      >
        Saltar al contenido
      </a>

      {/* Escritorio: barra lateral. En móvil manda la barra inferior de abajo. */}
      <DesktopSidebar className="justify-between gap-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <Link
            href="/dashboard"
            // Posición fija: 12 del riel + 8 + 16 = 36, el centro del riel contraído.
            className="flex h-10 min-w-0 items-center gap-2.5 rounded-lg px-2 font-semibold tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Image
              src="/images/psicoagenda-icon.png"
              alt=""
              width={32}
              height={28}
              className="h-7 w-8 shrink-0 object-contain"
              priority
            />
            <motion.span
              initial={false}
              animate={{ opacity: open ? 1 : 0 }}
              transition={{ duration: open ? 0.18 : 0.08, delay: open ? 0.06 : 0 }}
            >
              <Wordmark className="whitespace-nowrap text-[15px]" />
            </motion.span>
          </Link>

          <nav aria-label="Secciones" className="mt-6 flex flex-col gap-1">
            {/* Perfil y configuración viven en la tarjeta de cuenta de abajo, no en la lista. */}
            {filteredNav.filter((item) => item.href !== "/perfil").map((item) => {
              const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
              return (
                <SidebarLink
                  key={item.href}
                  active={isActivePath(pathname, item.href)}
                  badge={badgeOf(item.href)}
                  link={{ label: item.label, href: item.href, icon: <Icon className="size-[18px] shrink-0" /> }}
                />
              )
            })}
          </nav>
        </div>

        {/* Tarjeta de cuenta (estilo Discord): la foto y el nombre solo informan; el engrane lleva a la configuración. */}
        <div
          // Posición fija como el resto: la foto queda en 12 + 8 + 16 = 36 con el riel contraído.
          className="flex items-center gap-2.5 overflow-hidden rounded-xl bg-muted/40 p-2"
          title={!open ? displayName : undefined}
        >
          <span className="relative shrink-0">
            {user?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- la foto llega como data URL del perfil
              <img
                src={user.photoUrl}
                alt=""
                className="size-8 rounded-full border border-border/60 object-cover"
              />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(displayName)}
              </span>
            )}
            {/* Sesión activa */}
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500"
            />
          </span>
          <motion.span
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ duration: open ? 0.18 : 0.08, delay: open ? 0.06 : 0 }}
            className="min-w-0 flex-1"
          >
            <span className="block truncate text-xs font-semibold text-foreground">
              {isLoading ? "Cargando…" : displayName}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABELS[effectiveRole]}</span>
          </motion.span>
          <motion.span
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ duration: open ? 0.18 : 0.08, delay: open ? 0.06 : 0 }}
            className={cn("shrink-0", !open && "pointer-events-none")}
          >
            <Link
              href="/perfil"
              aria-label="Configuración"
              title="Configuración"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Settings className="size-[18px]" />
            </Link>
          </motion.span>
        </div>
      </DesktopSidebar>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="material scroll-edge sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/40 bg-background/75 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-6">
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        <main id="contenido" tabIndex={-1} className="flex-1 scroll-mt-14 p-4 pb-24 outline-none md:pb-6 lg:p-6">
          {children}
        </main>
      </div>

      {/* Barra inferior (móvil), material translúcido con margen para la zona segura */}
      <nav
        className="material fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border/60 bg-background/80 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        aria-label="Secciones"
      >
        {filteredNav.map((item) => {
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
