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

// TODO: filtrar NAV_ITEMS por el rol de la sesión cuando exista auth real.
