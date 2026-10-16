"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { UserRole } from "@psicoagenda/shared"
import { Wordmark } from "@/components/brand/wordmark"
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

/** Una sección queda activa también en sus subpáginas (/agenda/nueva → Agenda). */
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`))
}

// Física del cajón móvil (Designing Fluid Interfaces, WWDC 2018):
// resistencia progresiva más allá del borde y proyección del gesto por inercia.
function rubberband(offset: number, dimension: number, constant = 0.55): number {
  return (offset * dimension * constant) / (dimension + constant * Math.abs(offset))
}

function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

type DrawerDrag = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastTime: number
  velocity: number
  offset: number
  width: number
  tracking: boolean
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  // Desplazamiento y ancho del cajón mientras se arrastra (null cuando no hay gesto).
  const [drawerDrag, setDrawerDrag] = React.useState<{ offset: number; width: number } | null>(null)
  const asideRef = React.useRef<HTMLElement>(null)
  const dragRef = React.useRef<DrawerDrag | null>(null)
  const suppressClickRef = React.useRef(false)
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

  // Con el cajón abierto: Escape lo cierra y la página de fondo no se desplaza.
  React.useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [mobileOpen])

  // Arrastrar el cajón hacia la izquierda lo cierra: sigue al dedo 1:1, resiste
  // si se jala hacia la derecha y decide con la velocidad al soltar.
  function onDrawerPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!mobileOpen || window.matchMedia("(min-width: 1024px)").matches) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      offset: 0,
      width: asideRef.current?.offsetWidth ?? 240,
      tracking: false,
    }
  }

  function onDrawerPointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY

    if (!drag.tracking) {
      // Umbral de 10px y dirección dominante antes de comprometerse al gesto.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null
        return
      }
      if (Math.abs(dx) < 10) return
      drag.tracking = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    const elapsed = Math.max(1, event.timeStamp - drag.lastTime)
    drag.velocity = ((event.clientX - drag.lastX) / elapsed) * 1000
    drag.lastX = event.clientX
    drag.lastTime = event.timeStamp
    drag.offset = dx <= 0 ? Math.max(dx, -drag.width) : rubberband(dx, drag.width)
    setDrawerDrag({ offset: drag.offset, width: drag.width })
  }

  function onDrawerPointerEnd(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    dragRef.current = null
    if (!drag.tracking) return

    suppressClickRef.current = true
    setDrawerDrag(null)
    if (drag.offset + project(drag.velocity) < -drag.width / 2) setMobileOpen(false)
  }


  return (
    <div className="flex min-h-screen w-full">
      {/* Atenuación detrás del cajón móvil: aparece y se va con él */}
      <div
        className={cn(
          "fixed inset-0 z-[45] bg-black/40 transition-opacity duration-300 ease-out lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={
          drawerDrag && drawerDrag.offset < 0
            ? { opacity: Math.max(0, 1 + drawerDrag.offset / drawerDrag.width), transition: "none" }
            : undefined
        }
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Barra lateral: fija en escritorio, cajón deslizable en móvil */}
      <aside
        ref={asideRef}
        onPointerDown={onDrawerPointerDown}
        onPointerMove={onDrawerPointerMove}
        onPointerUp={onDrawerPointerEnd}
        onPointerCancel={onDrawerPointerEnd}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClickRef.current = false
          }
        }}
        className={cn(
          "material fixed inset-y-0 left-0 z-50 flex touch-pan-y flex-col border-r border-border/40 bg-card/70 text-foreground backdrop-blur-xl backdrop-saturate-150 transition-[translate,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:sticky lg:top-0 lg:h-dvh lg:bg-card/50",
          collapsed ? "w-[4.5rem]" : "w-60",
          mobileOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full lg:translate-x-0"
        )}
        style={drawerDrag ? { translate: `${drawerDrag.offset}px 0`, transition: "none" } : undefined}
        aria-label="Menú principal"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
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
                "whitespace-nowrap text-[15px] transition-opacity",
                collapsed && "lg:hidden"
              )}
            />
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="hidden size-7 rounded-lg text-muted-foreground hover:text-foreground lg:flex"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3" aria-label="Secciones">
          {filteredNav.map((item) => {
            const Icon = ICONS_BY_HREF[item.href] ?? PanelLeft
            const isActive = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted",
                  collapsed && "lg:justify-center lg:px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className={cn("whitespace-nowrap", collapsed && "lg:sr-only")}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-border/40 p-3">
          <Link
            href="/perfil"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl p-2.5 transition-colors duration-150 hover:bg-muted/60 active:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              collapsed && "lg:justify-center lg:p-2"
            )}
            title={collapsed ? displayName : undefined}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(displayName)}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-xs font-semibold text-foreground">
                {isLoading ? "Cargando…" : displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {displayRole ? ROLE_LABELS[displayRole] : "Psicólogo/a"}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="material scroll-edge sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/40 bg-background/75 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" />
          </Button>
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

        <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>

      {/* Barra inferior (móvil), material translúcido con margen para la zona segura */}
      <nav
        className="material fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border/60 bg-background/80 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
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
    </div>
  )
}
