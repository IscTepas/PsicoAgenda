import { APP_NAME } from "@psicoagenda/shared"
import { PantallaPerfilUsuario } from "./pantalla-perfil-usuario"

export const metadata = {
  title: `Perfil de Usuario | ${APP_NAME}`,
}

export default function ProfilePage() {
  return <PantallaPerfilUsuario />
}

