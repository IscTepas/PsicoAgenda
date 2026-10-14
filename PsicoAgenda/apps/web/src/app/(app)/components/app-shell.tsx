"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { APP_NAME, UserRole } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { navItemsForRole } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/use-session"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  User,
  Users,
  Bell,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react"

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/agenda": CalendarDays,
  "/pacientes": Users,
  "/notificaciones": Bell,
  "/reportes": BarChart3,
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, logout } = useSession()

  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const isPatient = effectiveRole === UserRole.PATIENT
  const filteredNav = React.useMemo(() => navItemsForRole(effectiveRole), [effectiveRole])

  const handleLogout = () => {
    void logout().finally(() => router.push("/login"))
  }

  const displayName = user?.name || (isPatient ? "María López" : "Dra. Ana García")
  const displayRole = effectiveRole

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/40 bg-card/50 backdrop-blur-md text-foreground transition-all duration-200 ease-out lg:static",
          collapsed ? "w-[4.5rem]" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-semibold text-foreground tracking-tight transition-opacity"
          >
            <Image
              src="/images/psicoagenda-icon.png"
              alt=""
              width={32}
              height={28}
              className="h-7 w-8 shrink-0 object-contain"
              priority
            />
            <span
              className={cn(
                "whitespace-nowrap font-semibold text-sm tracking-tight text-foreground transition-opacity",
                collapsed && "lg:hidden"
              )}
            >
              {APP_NAME}
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex size-7 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronLeft className="size-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden size-8 rounded-lg"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {filteredNav.map((item) => {
            const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={item.label}
              >
                <Icon className="size-[18px] shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-opacity",
                    collapsed && "lg:hidden"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border/40 p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl bg-muted/40 p-2.5 border border-border/30",
              collapsed && "justify-center p-2"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {getInitials(displayName)}
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 transition-opacity",
                collapsed && "lg:hidden"
              )}
            >
              <p className="truncate text-xs font-semibold text-foreground">
                {isLoading ? "Cargando..." : displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {displayRole ? ROLE_LABELS[displayRole] : "Psicólogo/a"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/40 bg-background/80 backdrop-blur-md px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden size-8 rounded-lg"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
      </div>

      {/* Menú Inferior (móvil) con enlaces directos: Inicio, Agenda, Pacientes, Reportes y Configuración */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around h-16 px-1 safe-area-pb">
        {filteredNav.map((item) => {
          const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-1.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", isActive ? "stroke-[2.5]" : "stroke-2")} />
              <span className="truncate max-w-[58px]">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
