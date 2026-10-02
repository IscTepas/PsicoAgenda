import { redirect } from "next/navigation"
import { APP_NAME, UserRole } from "@psicoagenda/shared"
import { createClient } from "@/lib/supabase/server"
import { readIdentity } from "@/lib/session"
import { PantallaBusquedaPaciente } from "./pantalla-busqueda-paciente"

export const metadata = {
  title: `Búsqueda de Pacientes | ${APP_NAME}`,
}

export default async function PatientsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const sessionUser = readIdentity(user)

  // Acceso restringido exclusivamente al profesional de psicología
  if (sessionUser?.role === UserRole.PATIENT) {
    redirect("/dashboard")
  }

  return <PantallaBusquedaPaciente />
}

