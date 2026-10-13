import { UserRole } from "@psicoagenda/shared"

export type NavItem = {
  href: string
  label: string
  roles: UserRole[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    roles: [UserRole.PSYCHOLOGIST, UserRole.PATIENT, UserRole.ADMIN],
  },
  {
    href: "/agenda",
    label: "Agenda",
    roles: [UserRole.PSYCHOLOGIST, UserRole.PATIENT, UserRole.ADMIN],
  },
  {
    href: "/pacientes",
    label: "Pacientes",
    roles: [UserRole.PSYCHOLOGIST, UserRole.ADMIN],
  },
  {
    href: "/notificaciones",
    label: "Notificaciones",
    roles: [UserRole.PSYCHOLOGIST, UserRole.PATIENT, UserRole.ADMIN],
  },
  {
    href: "/reportes",
    label: "Reportes",
    roles: [UserRole.PSYCHOLOGIST, UserRole.ADMIN],
  },
  {
    href: "/perfil",
    label: "Perfil",
    roles: [UserRole.PSYCHOLOGIST, UserRole.PATIENT, UserRole.ADMIN],
  },
]

/**
 * Entradas visibles para un rol. Sin sesión no se muestra nada: mostrar la navegación
 * completa y ocultarla después produce un destello de opciones no autorizadas.
 */
export function navItemsForRole(role: UserRole | null | undefined): NavItem[] {
  const activeRole = role ?? UserRole.PSYCHOLOGIST
  if (activeRole === UserRole.PSYCHOLOGIST) {
    return [
      { href: "/dashboard", label: "Inicio", roles: [UserRole.PSYCHOLOGIST] },
      { href: "/agenda", label: "Agenda", roles: [UserRole.PSYCHOLOGIST] },
      { href: "/pacientes", label: "Pacientes", roles: [UserRole.PSYCHOLOGIST] },
      { href: "/notificaciones", label: "Notificaciones", roles: [UserRole.PSYCHOLOGIST] },
      { href: "/reportes", label: "Reportes", roles: [UserRole.PSYCHOLOGIST] },
      { href: "/perfil", label: "Configuración", roles: [UserRole.PSYCHOLOGIST] },
    ]
  }
  return NAV_ITEMS.filter((item) => item.roles.includes(activeRole)).map((item) => {
    if (activeRole === UserRole.PATIENT && item.href === "/agenda") {
      return { ...item, label: "Mis Citas" }
    }
    return item
  })
}
