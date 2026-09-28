import { APP_NAME, MAX_APPOINTMENT_DURATION, MIN_APPOINTMENT_DURATION } from "@psicoagenda/shared";
import { CalendarClock, FileLock2, MessageSquare, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Agenda digital",
    description: `Citas de ${MIN_APPOINTMENT_DURATION} a ${MAX_APPOINTMENT_DURATION} minutos, con confirmación y control de asistencia.`,
  },
  {
    icon: FileLock2,
    title: "Expediente clínico",
    description: "Bitácora por sesión, antecedentes y consentimiento informado, con acceso restringido por rol.",
  },
  {
    icon: MessageSquare,
    title: "Recordatorios automáticos",
    description: "Avisos 24 horas antes de cada cita por WhatsApp y correo electrónico.",
  },
  {
    icon: ShieldCheck,
    title: "Confidencialidad",
    description: "Cifrado en tránsito y reposo, control de sesiones y cumplimiento de la LFPDPPP.",
  },
];

const CAPACIDADES = [
  "Registro con verificación en dos pasos",
  "Roles de psicólogo/a, paciente y administrador",
  "Tutores legales para pacientes menores de edad",
  "Reportes estadísticos exportables a PDF y Excel",
  "Estado de pago de honorarios (sin facturación electrónica)",
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Image src="/icons/icon.svg" alt="" width={28} height={28} aria-hidden />
            {APP_NAME}
          </span>
          <Badge variant="secondary">Fase de arquitectura</Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16">
        <section className="max-w-2xl space-y-6">
          <Badge variant="outline">Gestión de práctica clínica</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            La agenda y el expediente clínico de tu consulta, en un solo lugar
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            {APP_NAME} acompaña al profesional de la psicología desde la primera cita hasta el
            seguimiento del paciente: agenda, expediente, recordatorios y reportes, con la
            confidencialidad que exige la relación terapéutica.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-5 text-primary" aria-hidden />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="rounded-xl border bg-muted/40 p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Capacidades previstas</h2>
          <ul className="mt-4 grid gap-2 text-muted-foreground sm:grid-cols-2">
            {CAPACIDADES.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden>·</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-muted-foreground">
          {APP_NAME} — sistema en construcción. Especificaciones en{" "}
          <code className="font-mono">openspec/</code>.
        </div>
      </footer>
    </div>
  );
}
