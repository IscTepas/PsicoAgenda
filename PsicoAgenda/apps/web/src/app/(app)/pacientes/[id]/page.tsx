import { notFound } from "next/navigation"
import { APP_NAME } from "@psicoagenda/shared"
import {
  getAppointmentsByPatientId,
  getPatientById,
  getSessionLogsByPatientId,
} from "@/lib/mock-data"
import { PatientClinicalRecord } from "./patient-clinical-record"

export const metadata = {
  title: `Historial Clínico y Bitácora | ${APP_NAME}`,
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = getPatientById(id)

  if (!patient) {
    notFound()
  }

  const appointments = getAppointmentsByPatientId(id)
  const initialLogs = getSessionLogsByPatientId(id)

  return (
    <PatientClinicalRecord
      patient={patient}
      appointments={appointments}
      initialLogs={initialLogs}
    />
  )
}
