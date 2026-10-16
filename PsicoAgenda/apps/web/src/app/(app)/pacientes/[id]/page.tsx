import { redirect } from "next/navigation"
import { APP_NAME, UserRole } from "@psicoagenda/shared"
import { createClient } from "@/lib/supabase/server"
import { readIdentity } from "@/lib/session"
import { PatientClinicalRecord } from "./patient-clinical-record"

export const metadata = {
  title: `Historial Clínico y Bitácora | ${APP_NAME}`,
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const sessionUser = readIdentity(user)

  // Acceso restringido exclusivamente al profesional de psicología
  if (sessionUser?.role === UserRole.PATIENT) {
    redirect("/dashboard")
  }

  const { id } = await params

  return <PatientClinicalRecord patientId={id} />
}
