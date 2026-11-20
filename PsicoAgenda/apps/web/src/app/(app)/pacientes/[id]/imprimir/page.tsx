import { redirect } from "next/navigation"
import { APP_NAME, UserRole } from "@psicoagenda/shared"
import { createClient } from "@/lib/supabase/server"
import { readIdentity } from "@/lib/session"
import { ExpedienteImprimible } from "./expediente-imprimible"

export const metadata = {
  title: `Expediente clínico | ${APP_NAME}`,
}

export default async function ImprimirExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (readIdentity(user)?.role === UserRole.PATIENT) redirect("/dashboard")

  const { id } = await params
  return <ExpedienteImprimible patientId={id} />
}
