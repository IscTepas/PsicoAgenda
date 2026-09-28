import Link from "next/link"
import { Search, UserPlus } from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "../components/page-header"
import { MOCK_PATIENTS } from "@/lib/mock-data"

export const metadata = {
  title: `Pacientes | ${APP_NAME}`,
}

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacientes"
        description="Listado de pacientes registrados en tu práctica"
        actions={
          <Button disabled>
            <UserPlus className="mr-2 size-4" />
            Nuevo paciente
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Buscar pacientes</CardTitle>
          <CardDescription>
            Filtra por nombre, correo o teléfono
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Menor de edad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PATIENTS.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{patient.email}</TableCell>
                  <TableCell>{patient.phone ?? "—"}</TableCell>
                  <TableCell>
                    {patient.isMinor ? (
                      <Badge variant="secondary">Sí</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/pacientes/${patient.id}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
