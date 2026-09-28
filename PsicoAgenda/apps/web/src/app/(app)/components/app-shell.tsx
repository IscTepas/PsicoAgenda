"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { APP_NAME, UserRole } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { NAV_ITEMS } from "@/lib/navigation"
import { MOCK_PSYCHOLOGIST } from "@/lib/mock-data"
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
  type LucideIcon,
} from "lucide-react"

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/agenda": CalendarDays,
  "/pacientes": Users,
  "/notificaciones": Bell,
  "/reportes": BarChart3,
  "/perfil": User,
}

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PSYCHOLOGIST]: "Psicólogo/a",
  [UserRole.PATIENT]: "Paciente",
  [UserRole.ADMIN]: "Administrador",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useSession()

  const filteredNav = React.useMemo(() => {
    if (!user) return NAV_ITEMS
    return NAV_ITEMS.filter((item) => item.roles.includes(user.role))
  }, [user])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const displayName = user?.name ?? MOCK_PSYCHOLOGIST.name
  const displayRole = user?.role ?? MOCK_PSYCHOLOGIST.role

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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out lg:static",
          collapsed ? "w-[4.5rem]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 font-heading font-bold text-sidebar-primary-foreground transition-opacity",
              collapsed && "lg:opacity-0"
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              P
            </span>
            <span className="whitespace-nowrap">{APP_NAME}</span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="size-5 shrink-0" />
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

        <div className="border-t p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2",
              collapsed && "justify-center px-2"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
              {getInitials(displayName)}
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 transition-opacity",
                collapsed && "lg:hidden"
              )}
            >
              <p className="truncate text-sm font-medium">
                {displayName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                {ROLE_LABELS[displayRole]}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
            <LogOut className="size-5" />
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
