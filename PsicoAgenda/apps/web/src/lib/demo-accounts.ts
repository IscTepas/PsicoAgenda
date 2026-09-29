import { UserRole } from "@psicoagenda/shared"

export type DemoAccount = {
  label: string
  email: string
  password: string
  role: UserRole
  navItems: number
}

const VALID_ROLES: readonly string[] = Object.values(UserRole)

/**
 * Lee las cuentas de prueba desde `NEXT_PUBLIC_DEMO_ACCOUNTS`, un JSON con la forma
 * `[{"label","email","password","role","navItems"}]`.
 *
 * Por que las credenciales no estan en el codigo: un `NEXT_PUBLIC_` se inlinea en el
 * bundle que se sirve al navegador, asi que escribirlas aqui las meteria en el
 * repositorio de forma permanente. Definiendolas solo en `apps/web/.env` (ignorado por
 * git) quedan fuera del control de versiones.
 *
 * Lo que protege la pantalla de login es otra cosa: `process.env.NODE_ENV`, que Next
 * sustituye por una constante al compilar. En un build de produccion la comparacion
 * queda como `false` y el bunder elimina el JSX. Un flag `NEXT_PUBLIC_` no serviria,
 * porque ese si sobrevive en el bundle.
 */
export function parseDemoAccounts(raw: string | undefined): DemoAccount[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Una variable mal formada no debe tumbar la pagina de login.
    return []
  }

  if (!Array.isArray(parsed)) return []

  const accounts: DemoAccount[] = []
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue

    const { label, email, password, role, navItems } = entry as Record<string, unknown>
    if (typeof label !== "string" || !label) continue
    if (typeof email !== "string" || !email) continue
    if (typeof password !== "string" || !password) continue
    if (typeof role !== "string" || !VALID_ROLES.includes(role)) continue
    if (typeof navItems !== "number" || !Number.isFinite(navItems)) continue

    accounts.push({
      label,
      email,
      password,
      role: role as UserRole,
      navItems,
    })
  }
  return accounts
}

/**
 * Cuentas disponibles en el entorno actual. Vacio salvo que `apps/web/.env` defina la
 * variable, de modo que una copia del proyecto sin ella no muestra nada.
 *
 * El acceso es literal a proposito: Next solo inlinea `process.env.NEXT_PUBLIC_*` escrito
 * de forma estatica, no uno construido por nombre.
 */
export const demoAccounts: DemoAccount[] = parseDemoAccounts(
  process.env.NEXT_PUBLIC_DEMO_ACCOUNTS,
)
