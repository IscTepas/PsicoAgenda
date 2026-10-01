import Link from "next/link"
import {
  CalendarDays,
  Clock,
  FileText,
  MessageSquare,
  ShieldCheck,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  ChevronRight,
  Video,
  MapPin,
  TrendingUp,
} from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Agenda Digital Interactiva",
    badge: "Núcleo",
    description:
      "Vistas organizadas por Día, Semana y Mes. Verificación de disponibilidad horaria en tiempo real para evitar empalmes de citas.",
  },
  {
    icon: FileText,
    title: "Expediente Clínico Digital",
    badge: "Normativa",
    description:
      "Bitácora por sesión, notas clínicas estructuradas, antecedentes patológicos y diagnósticos basados en la clasificación CIE-10.",
  },
  {
    icon: MessageSquare,
    title: "Recordatorios Automáticos",
    badge: "Automatización",
    description:
      "Notificaciones automáticas con 24 horas de anticipación a través de WhatsApp y correo electrónico para mitigar el ausentismo.",
  },
  {
    icon: Users,
    title: "Gestión de Menores y Tutores",
    badge: "Legal",
    description:
      "Registro de tutores legales para pacientes pediátricos y adolescentes, con consentimiento informado digital firmado.",
  },
  {
    icon: TrendingUp,
    title: "Honorarios y Reportes",
    badge: "Gestión",
    description:
      "Control del estado de pago de sesiones clínicas y reportes estadísticos de asistencia exportables a formatos PDF y Excel.",
  },
  {
    icon: ShieldCheck,
    title: "Confidencialidad y LFPDPPP",
    badge: "Seguridad",
    description:
      "Cifrado de datos en reposo y en tránsito. Control estricto de accesos por roles clínicos (psicólogo, paciente y administrador).",
  },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* 1. NAVEGACIÓN SUPERIOR MINIMALISTA */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-2xs group-hover:scale-105 transition-transform">
              Ψ
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#caracteristicas" className="hover:text-foreground transition-colors">
              Características
            </a>
            <Link href="/agenda" className="hover:text-foreground transition-colors">
              Agenda Digital
            </Link>
            <a href="#seguridad" className="hover:text-foreground transition-colors">
              Confidencialidad
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" asChild className="rounded-xl text-xs font-semibold">
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button size="sm" asChild className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs">
              <Link href="/registro">Crear Cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-border/50">
          {/* Subtle green ambient glow background */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-primary/8 blur-3xl" />

          <div className="mx-auto max-w-5xl px-6 text-center space-y-6 relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1 text-xs font-medium text-primary shadow-2xs">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span>Gestión Clínica Moderna & Especializada</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-heading text-balance text-foreground leading-[1.12]">
              La plataforma clínica integral para{" "}
              <span className="text-primary underline decoration-primary/30 decoration-wavy underline-offset-8">
                profesionales de la psicología
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground text-pretty leading-relaxed">
              Administra tu agenda digital interactiva, expedientes clínicos bajo normativa CIE-10, recordatorios automáticos por WhatsApp y control de asistencia con máxima privacidad.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button size="lg" asChild className="h-11 px-6 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                <Link href="/agenda" className="flex items-center gap-2">
                  <span>Abrir Agenda Digital</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button variant="outline" size="lg" asChild className="h-11 px-6 rounded-xl font-semibold border-border hover:bg-muted text-foreground">
                <Link href="/login">Acceso con Cuenta Demo</Link>
              </Button>
            </div>

            {/* 3. SHOWCASE MOCKUP CARD DE LA AGENDA */}
            <div className="pt-10 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-xl text-left space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-3 rounded-full bg-rose-500/80" />
                    <div className="size-3 rounded-full bg-amber-500/80" />
                    <div className="size-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-medium text-muted-foreground pl-2">
                      Vista previa · Agenda Clínica
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary bg-primary/5">
                    Sesiones de hoy
                  </Badge>
                </div>

                {/* Simulated Appointment Preview Rows */}
                <div className="grid gap-2.5">
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center">
                        ML
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          María López · Terapia individual
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="size-3" /> 10:00 - 10:50
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" /> Presencial
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      <CheckCircle2 className="size-3" /> Confirmada
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-amber-500/15 text-amber-700 font-bold text-xs flex items-center justify-center">
                        LH
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          Luis Hernández · Evaluación inicial
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="size-3" /> 12:00 - 12:50
                          </span>
                          <span className="flex items-center gap-1 text-primary">
                            <Video className="size-3" /> Virtual
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      Pendiente
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        SM
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          Sofía Martínez · Terapia infantil
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="size-3" /> 16:00 - 16:50
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" /> Presencial
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      Confirmada
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. CARACTERÍSTICAS PRINCIPALES */}
        <section id="caracteristicas" className="py-16 md:py-20 bg-muted/20 border-b border-border/50">
          <div className="mx-auto max-w-6xl px-6 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                Módulos del Sistema
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
                Diseñado para el ritmo de la consulta psicológica
              </h2>
              <p className="text-sm text-muted-foreground">
                Herramientas construidas para cumplir con requerimientos clínicos reales y normativas de privacidad.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, badge, description }) => (
                <div
                  key={title}
                  className="rounded-2xl bg-card p-6 border border-border/70 shadow-2xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                        {badge}
                      </span>
                    </div>
                    <h3 className="font-heading font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center text-xs font-medium text-primary">
                    <span>Saber más</span>
                    <ChevronRight className="size-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. SEGURIDAD Y PRIVACIDAD */}
        <section id="seguridad" className="py-16 bg-card border-b border-border/50">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-3xl border border-primary/20 bg-primary/[0.02] p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                  <Lock className="size-4" />
                  <span>Confidencialidad Médica Garantizada</span>
                </div>
                <h3 className="text-2xl font-bold font-heading text-foreground">
                  Apego a la LFPDPPP y secreto profesional terapéutico
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Los registros clínicos de salud mental demandan el estándar más riguroso de custodia. {APP_NAME} aísla los expedientes clínicos por profesional y paciente, asegurando que la información sensible permanezca siempre confidencial.
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
                <Button size="lg" asChild className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                  <Link href="/registro">Comenzar Gratis</Link>
                </Button>
                <span className="text-[11px] text-center text-muted-foreground">
                  Sin tarjeta de crédito requerida
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 6. FOOTER */}
      <footer className="border-t border-border/70 py-8 bg-card text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
              Ψ
            </div>
            <span className="font-semibold text-foreground">{APP_NAME}</span>
            <span>© {new Date().getFullYear()}</span>
            <span>· Práctica Clínica Psicológica</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/agenda" className="hover:text-foreground transition-colors">
              Agenda
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Iniciar Sesión
            </Link>
            <Link href="/registro" className="hover:text-foreground transition-colors">
              Registro
            </Link>
            <span className="text-muted-foreground/60 font-mono">openspec/</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
