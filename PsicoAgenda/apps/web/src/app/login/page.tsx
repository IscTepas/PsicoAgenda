import { APP_NAME } from "@psicoagenda/shared"
import { LoginForm } from "./login-form"
import { DemoLoginButtons } from "./demo-login-buttons"

export const metadata = {
  title: `Iniciar sesión | ${APP_NAME}`,
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <LoginForm />
      <div className="w-full max-w-sm space-y-2">
        <p className="text-center text-sm text-muted-foreground">Acceso de demostración</p>
        <DemoLoginButtons />
      </div>
    </div>
  )
}
