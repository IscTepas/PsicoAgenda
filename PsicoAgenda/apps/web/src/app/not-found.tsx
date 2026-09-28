import Link from "next/link"
import { APP_NAME } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = {
  title: `Página no encontrada | ${APP_NAME}`,
}

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            Página no encontrada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            La ruta que buscas no existe o no tienes acceso.
          </p>
          <Button asChild>
            <Link href="/dashboard">Ir al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
