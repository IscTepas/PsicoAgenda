import { Mail, Phone, User } from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "../components/page-header"
import { MOCK_PSYCHOLOGIST } from "@/lib/mock-data"

export const metadata = {
  title: `Perfil | ${APP_NAME}`,
}

export default function ProfilePage() {
  const initials = MOCK_PSYCHOLOGIST.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        description="Tus datos personales y profesionales"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{MOCK_PSYCHOLOGIST.name}</CardTitle>
              <CardDescription>{MOCK_PSYCHOLOGIST.specialty}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" />
              <span>{MOCK_PSYCHOLOGIST.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="size-4 text-muted-foreground" />
              <span>{MOCK_PSYCHOLOGIST.phone ?? "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="size-4 text-muted-foreground" />
              <span>Cédula: {MOCK_PSYCHOLOGIST.licenseNumber}</span>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-medium">Biografía</h3>
            <p className="text-muted-foreground">
              {MOCK_PSYCHOLOGIST.bio ?? "Sin biografía"}
            </p>
          </div>

          <div className="flex justify-end">
            <Button disabled>Editar perfil</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
