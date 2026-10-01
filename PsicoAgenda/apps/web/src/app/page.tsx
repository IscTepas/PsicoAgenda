import Link from "next/link";
import { APP_NAME, MAX_APPOINTMENT_DURATION, MIN_APPOINTMENT_DURATION } from "@psicoagenda/shared";
import {
  CalendarClock,
  FileLock2,
  MessageSquare,
  ShieldCheck,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Apple Translucent Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#F5F5F7]/85 dark:bg-[#000000]/80 border-b border-black/[0.06] dark:border-white/[0.08] transition-all">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-sm tracking-tight text-neutral-900 dark:text-white">
            <div className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold shadow-sm">
              Ψ
            </div>
            <span>{APP_NAME}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
            <a href="#agenda" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Agenda</a>
            <a href="#expediente" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Expediente Clínico</a>
            <a href="#privacidad" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Privacidad LFPDPPP</a>
            <a href="#capacidades" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Capacidades</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="text-[13px] font-medium bg-[#0071E3] hover:bg-[#0077ED] text-white px-4 py-1.5 rounded-full shadow-sm hover:shadow active:scale-[0.97] transition-all"
            >
              Comenzar
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Apple Keynote Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-20 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 backdrop-blur-md shadow-xs mb-8">
            <Sparkles className="size-3.5 text-[#0071E3]" />
            <span>Gestión clínica moderna para profesionales de la psicología</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-neutral-900 dark:text-white max-w-4xl leading-[1.08] text-balance">
            Tu consulta clínica.{" "}
            <span className="bg-gradient-to-r from-[#0071E3] via-[#2997FF] to-[#0077ED] bg-clip-text text-transparent">
              Elevada a la perfección.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl font-normal leading-relaxed text-balance">
            Agenda de citas, expediente confidencial con bitácora clínica y recordatorios automáticos por WhatsApp. Creado con la elegancia, fluidez y privacidad que tu práctica terapéutica merece.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-[15px] px-7 py-3 shadow-md hover:shadow-lg active:scale-[0.975] transition-all"
            >
              <span>Probar Demo Inmediata</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[#1C1C1E] hover:bg-neutral-100 dark:hover:bg-[#2C2C2E] text-neutral-900 dark:text-white font-medium text-[15px] px-7 py-3 border border-black/[0.08] dark:border-white/[0.1] shadow-xs active:scale-[0.975] transition-all"
            >
              Crear cuenta de consulta
            </Link>
          </div>

          <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
            Sin instalación compleja • Funciona en navegador y móvil PWA • Cumplimiento LFPDPPP
          </p>

          {/* Floating macOS App Preview Window */}
          <div className="mt-14 w-full rounded-2xl sm:rounded-[28px] bg-white dark:bg-[#1C1C1E] p-3 sm:p-5 border border-black/[0.08] dark:border-white/[0.1] shadow-[0_20px_70px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.5)]">
            {/* macOS Chrome Titlebar */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-black/[0.06] dark:border-white/[0.08] px-2">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-[#FF5F56] border border-black/[0.1]" />
                <div className="size-3 rounded-full bg-[#FFBD2E] border border-black/[0.1]" />
                <div className="size-3 rounded-full bg-[#27C93F] border border-black/[0.1]" />
              </div>
              <div className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500 truncate">
                PsicoAgenda — Consulta Clínica de Dra. Ana García
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#0071E3] font-medium bg-[#0071E3]/10 px-2.5 py-0.5 rounded-full">
                <span className="size-1.5 rounded-full bg-[#0071E3] animate-pulse" />
                En vivo
              </div>
            </div>

            {/* Inner App Interface Preview */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 text-left">
              {/* Left Column: Agenda & Sessions */}
              <div className="md:col-span-5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 p-4 border border-black/[0.04] dark:border-white/[0.04] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                    Agenda de Hoy
                  </span>
                  <span className="text-[11px] text-neutral-500">3 citas agendadas</span>
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg bg-white dark:bg-[#1C1C1E] p-3 shadow-2xs border border-black/[0.04] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-900 dark:text-white">Sofía Ramírez</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">En curso</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-1">
                      <Clock className="size-3 text-[#0071E3]" />
                      <span>10:00 - 10:50 AM (50 min) • TCC</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white dark:bg-[#1C1C1E] p-3 shadow-2xs border border-black/[0.04] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-900 dark:text-white">Carlos Mendoza</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">Confirmada</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-1">
                      <Clock className="size-3 text-neutral-400" />
                      <span>11:30 - 12:20 PM • Primera consulta</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white dark:bg-[#1C1C1E] p-3 shadow-2xs border border-black/[0.04] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-900 dark:text-white">Mateo M. (14 años)</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">Tutor: Laura M.</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-1">
                      <Clock className="size-3 text-neutral-400" />
                      <span>04:00 - 04:50 PM • Seguimiento</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Expediente Clínico Active Note */}
              <div className="md:col-span-7 rounded-xl bg-white dark:bg-[#1C1C1E] p-4 border border-black/[0.04] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2.5">
                  <div>
                    <h2 className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Expediente #PA-2026-089
                    </h2>
                    <p className="text-[11px] text-neutral-500">Sofía Ramírez • 28 años • Sesión 4 de 12</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="size-3" />
                    <span>Consentimiento firmado</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px]">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">Diagnóstico preliminar: </span>
                    <span className="text-neutral-500">F41.1 Trastorno de ansiedad generalizada (CIE-10)</span>
                  </div>

                  <div className="rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E]/50 p-3 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans border border-black/[0.03]">
                    <span className="font-medium text-neutral-900 dark:text-white block mb-1">
                      Bitácora de Sesión:
                    </span>
                    Paciente reporta disminución en episodios de rumiación nocturna mediante registro de pensamientos automáticos. Se modela técnica de respiración diafragmática. Próxima cita programada con recordatorio de 24h.
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 p-2 text-center">
                      <span className="block text-[10px] text-neutral-400">Honorarios</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Cubiertos</span>
                    </div>
                    <div className="rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 p-2 text-center">
                      <span className="block text-[10px] text-neutral-400">WhatsApp</span>
                      <span className="text-xs font-semibold text-[#0071E3]">Enviado 24h</span>
                    </div>
                    <div className="rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 p-2 text-center">
                      <span className="block text-[10px] text-neutral-400">Seguridad</span>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Cifrado LFPDPPP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid: Core Capabilities */}
        <section id="capacidades" className="mx-auto max-w-5xl px-6 py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
              Diseñado con rigor clínico
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Todo lo que necesitas en tu práctica diaria
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Agenda */}
            <div id="agenda" className="rounded-[28px] bg-white dark:bg-[#1C1C1E] p-7 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-[#0071E3] mb-5">
                  <CalendarClock className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Agenda de Citas Inteligente
                </h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Citas flexibles de {MIN_APPOINTMENT_DURATION} a {MAX_APPOINTMENT_DURATION} minutos. Detección automática de huecos libres, control de asistencia y cancelaciones oportunas.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] text-xs font-medium text-[#0071E3] flex items-center gap-1">
                <span>Vistas por Día, Semana y Mes</span>
              </div>
            </div>

            {/* Card 2: Expediente & Bitácora */}
            <div id="expediente" className="rounded-[28px] bg-white dark:bg-[#1C1C1E] p-7 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-5">
                  <FileLock2 className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Expediente Clínico & Bitácora
                </h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Registro inmutable de bitácoras por sesión, historial diagnóstico CIE-10 y evolución terapéutica protegida con control estricto de roles (RD-03).
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>Historial con versión inmutable</span>
              </div>
            </div>

            {/* Card 3: Recordatorios */}
            <div className="rounded-[28px] bg-white dark:bg-[#1C1C1E] p-7 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400 mb-5">
                  <MessageSquare className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Avisos por WhatsApp y Correo
                </h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Recordatorios automáticos 24 horas antes de cada cita por WhatsApp y correo electrónico para reducir drásticamente el ausentismo de pacientes.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                <span>Avisos con 24h de anticipación</span>
              </div>
            </div>

            {/* Card 4: Tutores Legales */}
            <div className="rounded-[28px] bg-white dark:bg-[#1C1C1E] p-7 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-5">
                  <Users className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Tutores Legales y Menores
                </h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Gestión integral para pacientes menores de edad (RD-11). Vinculación con tutor legal responsable y consentimiento informado firmado digitalmente.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <span>Consentimiento legal digital</span>
              </div>
            </div>

            {/* Card 5: Reportes y Honorarios */}
            <div className="rounded-[28px] bg-white dark:bg-[#1C1C1E] p-7 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <BarChart3 className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Honorarios & Reportes
                </h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Control de estado de pagos por sesión de manera sencilla. Estadísticas de asistencia, cancelaciones y reportes exportables a PDF y Excel.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span>Exportación a PDF y Excel</span>
              </div>
            </div>

            {/* Card 6: Privacidad y LFPDPPP */}
            <div id="privacidad" className="rounded-[28px] bg-white dark:bg-[#1C1C1E] p-7 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-5">
                  <ShieldCheck className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Confidencialidad y LFPDPPP
                </h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Cifrado de datos en reposo y tránsito. Sesiones con expiración segura y separación rigurosa de accesos entre psicólogo, paciente y administrador.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] text-xs font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1">
                <Lock className="size-3" />
                <span>Cumplimiento legal garantizado</span>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-[32px] bg-gradient-to-b from-white to-[#F5F5F7] dark:from-[#1C1C1E] dark:to-[#121214] p-8 sm:p-12 border border-black/[0.08] dark:border-white/[0.1] text-center shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Comienza a optimizar tu práctica terapéutica
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
              Accede a la plataforma con una cuenta demo para explorar la agenda y el expediente clínico al instante.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm px-6 py-2.5 shadow-sm active:scale-[0.975] transition-all"
              >
                Acceso Rápido Demo
              </Link>
              <Link
                href="/registro"
                className="rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] text-neutral-900 dark:text-white font-medium text-sm px-6 py-2.5 active:scale-[0.975] transition-all"
              >
                Crear Nueva Cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Apple Minimalist Footer */}
      <footer className="border-t border-black/[0.06] dark:border-white/[0.08] py-8 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-bold flex items-center justify-center">
              Ψ
            </div>
            <span>{APP_NAME} © {new Date().getFullYear()}</span>
            <span>•</span>
            <span>Práctica clínica y salud mental</span>
          </div>

          <div className="flex items-center gap-6">
            <span>Cumplimiento LFPDPPP</span>
            <span>CIE-10 Clínico</span>
            <span className="text-neutral-400 dark:text-neutral-600 font-mono">openspec/</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
