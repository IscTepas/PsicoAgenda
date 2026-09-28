import { APP_NAME } from "@psicoagenda/shared"
import { RegisterForm } from "./register-form"

export const metadata = {
  title: `Crear cuenta | ${APP_NAME}`,
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <RegisterForm />
    </div>
  )
}
