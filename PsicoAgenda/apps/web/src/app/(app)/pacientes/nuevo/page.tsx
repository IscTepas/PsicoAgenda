import { APP_NAME } from "@psicoagenda/shared"
import { NewPatientForm } from "./new-patient-form"

export const metadata = {
  title: `Nuevo paciente | ${APP_NAME}`,
}

// Se llega aquí desde el panel (?desde=inicio) o desde el directorio de
// pacientes; "Volver" y "Cancelar" regresan al lugar de origen.
export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { desde } = await searchParams
  const back =
    desde === "inicio"
      ? { href: "/dashboard", label: "Volver al inicio" }
      : { href: "/pacientes", label: "Volver a pacientes" }

  return <NewPatientForm backHref={back.href} backLabel={back.label} />
}
