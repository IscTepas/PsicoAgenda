import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ArrowUpRight, ChevronRight, Mail, MessageCircle, Phone, Plus } from "lucide-react"
import { APP_NAME } from "@psicoagenda/shared"
import { Wordmark } from "@/components/brand/wordmark"
import { Button } from "@/components/ui/button"
import { FACTS, FAQ, PRACTICE, SERVICES } from "./home-content"
import { OpenStatus } from "./open-status"

export const metadata: Metadata = {
  title: { absolute: `${PRACTICE.psychologist} · Atención psicológica | ${APP_NAME}` },
  description: `Atención psicológica en consultorio y en línea con ${PRACTICE.psychologist}. Agenda, cambia o cancela tus citas desde tu cuenta.`,
}

const NAV_LINKS = [
  { href: "#consultorio", label: "Consultorio" },
  { href: "#servicios", label: "Servicios" },
  { href: "#preguntas", label: "Preguntas" },
  { href: "#contacto", label: "Contacto" },
]

function getInitials(name: string): string {
  return name
    .replace(/^(Dra\.|Dr\.|Psic\.|Lic\.)\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(PRACTICE.mapQuery)}&z=16&output=embed`

const CONTACT = [
  { icon: MessageCircle, label: "WhatsApp", value: PRACTICE.phoneDisplay, href: `https://wa.me/${PRACTICE.phoneE164}`, external: true },
  { icon: Phone, label: "Teléfono", value: PRACTICE.phoneDisplay, href: `tel:+${PRACTICE.phoneE164}`, external: false },
  { icon: Mail, label: "Correo", value: PRACTICE.email, href: `mailto:${PRACTICE.email}`, external: false },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <header className="material scroll-edge sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <Image
              src="/images/psicoagenda-icon.png"
              alt=""
              width={40}
              height={35}
              className="h-[35px] w-10 shrink-0 object-contain"
              priority
            />
            <Wordmark className="text-lg" />
          </Link>

          <nav aria-label="Secciones" className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/registro">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Saludo + ficha del consultorio */}
        <section id="consultorio" className="mx-auto max-w-6xl scroll-mt-16 px-6 pb-20 pt-14 md:pb-24 md:pt-20">
          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl md:text-[3.5rem]">
              Un espacio seguro para hablar de lo que te pesa.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Atención psicológica en consultorio y en línea con {PRACTICE.psychologist}. Agenda, cambia o
              cancela tus citas desde tu cuenta.
            </p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/registro">
                  Crear cuenta para agendar
                  <ArrowRight className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="w-full sm:w-auto">
                <Link href="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:mt-16 lg:grid-cols-12">
            {/* La ficha */}
            <article
              aria-labelledby="ficha-nombre"
              className="min-w-0 rounded-3xl border border-border bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)] sm:p-8 lg:col-span-7"
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
                  aria-hidden="true"
                >
                  {getInitials(PRACTICE.psychologist)}
                </div>
                <div className="min-w-0">
                  <h2 id="ficha-nombre" className="truncate text-xl font-semibold tracking-tight">
                    {PRACTICE.psychologist}
                  </h2>
                  <p className="text-sm text-muted-foreground">{PRACTICE.specialty}</p>
                </div>
              </div>

              {/* Presentación en sus palabras */}
              <blockquote className="mt-5 border-l-2 border-primary/40 pl-4 text-[15px] italic leading-relaxed text-foreground/80">
                {PRACTICE.bio}
              </blockquote>

              <dl className="mt-6 divide-y divide-border border-t border-border">
                {FACTS.map((fact) => (
                  <div key={fact.label} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                    <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                    <dd className="text-[15px] font-medium leading-snug tabular-nums">
                      {Array.isArray(fact.value)
                        ? fact.value.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))
                        : fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>

            {/* Ubicación y contacto */}
            <aside
              id="contacto"
              aria-labelledby="contacto-titulo"
              className="flex min-w-0 scroll-mt-20 flex-col rounded-3xl bg-muted/60 p-6 sm:p-8 lg:col-span-5"
            >
              <OpenStatus hours={PRACTICE.hours} timeZone={PRACTICE.timeZone} />

              <h2 id="contacto-titulo" className="mt-6 text-lg font-semibold tracking-tight">
                Consultorio
              </h2>
              <address className="mt-1 not-italic leading-relaxed text-muted-foreground">{PRACTICE.address}</address>
              {/* Mapa (trae su propio "Ver en Maps"): ocupa el alto que sobra junto a la ficha */}
              <div className="mt-5 flex min-h-48 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
                <iframe
                  title={`Mapa: ${PRACTICE.address}`}
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block min-h-48 w-full flex-1 border-0"
                />
              </div>

              {/* Lista agrupada al estilo iOS: filas de 48px que se iluminan al tocar */}
              <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {CONTACT.map(({ icon: Icon, label, value, href, external }) => {
                  const Trailing = external ? ArrowUpRight : ChevronRight
                  return (
                    <li key={label}>
                      <a
                        href={href}
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="group flex min-h-12 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50 active:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40"
                      >
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="w-20 shrink-0 text-sm text-muted-foreground">{label}</span>
                        <span className="min-w-0 flex-1 text-[15px] font-medium tabular-nums [overflow-wrap:anywhere]">{value}</span>
                        <Trailing
                          className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  )
                })}
              </ul>
            </aside>
          </div>
        </section>

        {/* Servicios */}
        <section id="servicios" className="scroll-mt-16 border-t border-border/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:py-24 lg:grid-cols-12">
            <div className="reveal lg:col-span-4">
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.025em]">Cómo te puede ayudar</h2>
              <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
                Si no sabes cuál elegir, empieza por una evaluación inicial.
              </p>
            </div>

            <ul className="divide-y divide-border border-y border-border lg:col-span-8">
              {SERVICES.map((service) => (
                <li key={service.name} className="reveal grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{service.name}</h3>
                    <p className="mt-1 max-w-prose leading-relaxed text-muted-foreground">{service.description}</p>
                  </div>
                  <span className="justify-self-start whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/75">
                    {service.modalities}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Preguntas frecuentes */}
        <section id="preguntas" className="scroll-mt-16 border-t border-border/60 bg-muted/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:py-24 lg:grid-cols-12">
            <div className="reveal lg:col-span-4">
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.025em]">Preguntas frecuentes</h2>
              <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
                ¿Tienes otra duda?{" "}
                <a href="#contacto" className="inline-flex items-center gap-0.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                  Escríbenos
                  <ChevronRight className="size-4" aria-hidden="true" />
                </a>
              </p>
            </div>

            <div className="reveal divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card lg:col-span-8">
              {FAQ.map((item) => (
                <details key={item.question} className="disclosure group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium transition-colors duration-150 hover:bg-muted/40 active:bg-muted/70 outline-none focus-visible:bg-muted/40 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-6 [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <Plus
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="max-w-prose px-5 pb-5 leading-relaxed text-muted-foreground sm:px-6">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Cierre */}
        <section className="bg-primary text-primary-foreground">
          <div className="reveal mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between md:py-20">
            <div>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.025em]">
                Tu primera cita empieza con una cuenta.
              </h2>
              <p className="mt-2 text-primary-foreground">Créala y elige el horario que mejor te acomode.</p>
            </div>
            <Button size="lg" asChild className="self-start bg-background text-foreground hover:bg-background/90 md:self-auto">
              <Link href="/registro">
                Crear cuenta
                <ArrowRight className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/psicoagenda-icon.png"
              alt=""
              width={28}
              height={25}
              className="h-[25px] w-7 shrink-0 object-contain"
            />
            <Wordmark />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="-my-2 rounded-sm py-2 transition-colors hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="-my-2 rounded-sm py-2 transition-colors hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
