# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Patients (primary audience of the public home page):** people looking for psychological care, or already in treatment, who reach the site to learn about the practice and then create an account to request, reschedule, or cancel appointments. Basic phone or computer skills; WhatsApp is their main channel.
- **Psychologist (primary user of the private app):** runs the practice day to day — agenda, attendance, session notes, clinical history, reports.
- **Administrator:** assigns roles. Psychologist accounts are not self-registered; public sign-up creates patient accounts only.

## Product Purpose

PsicoAgenda replaces paper agendas, spreadsheets, and scattered WhatsApp messages for a psychology practice: patients book and manage their own appointments and get automatic reminders, and the psychologist keeps agenda, attendance, and clinical records in one confidential place. Success for the public home page: a prospective patient understands who attends them, what kind of help is offered, how booking works, and that their information is confidential — then creates an account.

## Positioning

The public site presents one concrete practice (a psychologist and their consultorio), not a generic SaaS. The patient gets self-service booking with reminders by WhatsApp and email, inside a system built around clinical confidentiality.

## Operating Context

- Sessions last 45–60 minutes; modality is in person or online (the video call itself happens outside PsicoAgenda).
- Reminders go out automatically by WhatsApp and email ahead of each appointment.
- Patients can request, reschedule, and cancel appointments from their account.
- Minors are registered with a legal guardian, who gives informed consent; an emergency contact is required at admission.
- Patients may request an export of their appointment history and notes (data portability).

## Capabilities and Constraints

- Public routes: `/` (home), `/login`, `/registro` (patients only), `/recuperar`.
- The home page must not expose demo-account access or deep links into the private app (e.g. "open digital agenda").
- Out of scope for the product: electronic invoicing/accounting, integrated video calls, interdisciplinary records. Online payments and a native patient app are future work, not current capabilities.
- Interface language: Spanish (Mexico).

## Brand Commitments

- Name: PsicoAgenda. Logo: `public/images/psicoagenda-logo.png` (full lockup) and `public/images/psicoagenda-icon.png` (icon only).
- Keep the existing white/green color base across all screens (user-confirmed, repeatedly).
- Tone toward patients: formal, ethical, warm, and confidential (RD-04). Avoid clinical-software jargon (CIE-10, LFPDPPP codes, "módulos") on patient-facing pages.
- Patient-facing pages must stay light on text — not saturated.

## Evidence on Hand

- The user has real content for: services / types of therapy, contact details and location, and FAQ — not yet provided in the repository.
- Current placeholder data in `src/lib/mock-data.ts`: "Dra. Ana García", "Psicología clínica", "Paseo de la Reforma #450, Piso 3, Consultorio 3B, CDMX". Treat as placeholders until replaced.
- No testimonials, patient counts, ratings, credentials (cédula), prices, or photos exist. Do not fabricate them.

## Product Principles

1. The patient should always know what happens next and how to change it.
2. Confidentiality is shown through how things work, not through legal codes.
3. Fewer words, clearer steps: every block earns its place.
4. One practice, one human face — the system serves the relationship, not the other way around.

## Accessibility & Inclusion

Usable by patients with basic digital skills on mobile first; plain Spanish; guardians acting on behalf of minors.
