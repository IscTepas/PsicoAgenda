"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { UserRole } from "@psicoagenda/shared"
import { Wordmark } from "@/components/brand/wordmark"
import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from "@/components/motion/animated-sidebar"
import { Button } from "@/components/ui/button"
import { ToastProvider } from "@/components/toast-provider"
import { navItemsForRole } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/use-session"
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
      <AnimatedSidebarProvider style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "4.5rem" }}>
        <ShellContent>{children}</ShellContent>
      </AnimatedSidebarProvider>
    </ToastProvider>
  )
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, logout } = useSession()
  const { state, isMobile, setOpenMobile } = useAnimatedSidebar()
  // En móvil el cajón siempre va expandido; el riel de iconos es solo de escritorio.
  const collapsed = state === "collapsed" && !isMobile

  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const filteredNav = React.useMemo(() => navItemsForRole(effectiveRole), [effectiveRole])

  const handleLogout = () => {
    void logout().finally(() => router.push("/login"))
  }

  const displayName = user?.name || "Tu cuenta"

  return (
    <>
      <AnimatedSidebar
        ariaLabel="Menú principal"
        collapsible="icon"
        className="material bg-card/70 backdrop-blur-xl backdrop-saturate-150"
        panelClassName="material border-border/40 bg-card/50 backdrop-blur-xl backdrop-saturate-150"
      >
        <AnimatedSidebarHeader className="h-14 flex-row items-center border-b border-border/40 px-4 py-0">
          <Link
            href="/dashboard"
            onClick={() => setOpenMobile(false)}
            className="flex min-w-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Image
              src="/images/psicoagenda-icon.png"
              alt=""
              width={32}
              height={28}
              className="h-7 w-8 shrink-0 object-contain"
              priority
            />
            <Wordmark
              className={cn(
                "whitespace-nowrap text-[15px] transition-opacity duration-150",
                collapsed && "opacity-0",
              )}
            />
          </Link>
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent className="p-3">
          <nav aria-label="Secciones">
            <AnimatedSidebarMenu>
              {filteredNav.map((item) => {
                const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
                return (
                  <AnimatedSidebarMenuItem key={item.href}>
                    <AnimatedSidebarMenuButton
                      href={item.href}
                      isActive={isActivePath(pathname, item.href)}
                      icon={<Icon className="size-[18px]" />}
                      className="min-h-10"
                    >
                      {item.label}
                    </AnimatedSidebarMenuButton>
                  </AnimatedSidebarMenuItem>
                )
              })}
            </AnimatedSidebarMenu>
          </nav>
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter className="border-border/40">
          <Link
            href="/perfil"
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-3 overflow-hidden rounded-xl p-1.5 transition-colors duration-150 hover:bg-muted/60 active:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            title={collapsed ? displayName : undefined}
          >
            {user?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- la foto llega como data URL del perfil
              <img
                src={user.photoUrl}
                alt=""
                className="size-8 shrink-0 rounded-full border border-border/60 object-cover"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(displayName)}
              </div>
            )}
            <div className={cn("min-w-0 flex-1 transition-opacity duration-150", collapsed && "opacity-0")}>
              <p className="truncate text-xs font-semibold text-foreground">
                {isLoading ? "Cargando…" : displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{ROLE_LABELS[effectiveRole]}</p>
            </div>
          </Link>
        </AnimatedSidebarFooter>
      </AnimatedSidebar>

      {/* Contenido */}
      <AnimatedSidebarInset className="bg-transparent">
        <header className="material scroll-edge sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/40 bg-background/75 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-6">
          <AnimatedSidebarTrigger
            aria-label="Mostrar u ocultar menú"
            title="Mostrar u ocultar menú (Ctrl+B)"
            className="size-9 rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <PanelLeft className="size-5" />
          </AnimatedSidebarTrigger>
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

        <div className="flex-1 p-4 pb-24 md:pb-6 lg:p-6">{children}</div>
      </AnimatedSidebarInset>

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
              <Icon className={cn("size-5", isActive ? "stroke-[2.5]" : "stroke-2")} aria-hidden="true" />
              <span className="max-w-[58px] truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
