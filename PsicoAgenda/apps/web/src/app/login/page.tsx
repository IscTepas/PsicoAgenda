import { APP_NAME } from "@psicoagenda/shared"
import { LoginForm } from "./login-form"

export const metadata = {
  title: `Iniciar sesión | ${APP_NAME}`,
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <LoginForm />
    </div>
  )
}
