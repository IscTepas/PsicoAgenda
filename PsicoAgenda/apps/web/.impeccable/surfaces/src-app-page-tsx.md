---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Inicio (página pública)

Scope: `/` home page. Mode: Persuade. Audience: prospective and current patients of one practice, mostly on mobile. Job: understand who attends, how, how long, when and where, and that it is confidential; then create an account. Content is placeholder (mock-data) until the user supplies real services, contact, schedule and FAQ; keep all copy in one content module (src/app/home-content.ts) so it can be swapped.

Removed on purpose: "Abrir Agenda Digital", "Acceso con Cuenta Demo", agenda preview mock, psychologist-facing feature grid (CIE-10, LFPDPPP, módulos, honorarios), "Comenzar gratis", "openspec/".

Mobile nav (below md): section anchors are hidden on purpose. The page is one short column on phones, the anchors would compete with Crear cuenta in a 390px bar, and the hero carries Ya tengo cuenta in the first viewport.

Open decisions: real content; portrait photo (initials until then); privacy-notice page does not exist (no footer link yet); map as "Cómo llegar" link, not an embed.

## Direction contract

THESIS: The home page is the practice's ficha: one card answers who attends, approach, modality, duration, schedule and how booking works at a glance. It refuses the SaaS feature-grid hero and icon-tile cards.

OWN-WORLD: The established PsicoAgenda world: white ground, teal primary token, neutral muted bands, hairline borders, rounded-2xl/3xl surfaces as in login and the dashboard, Geist with tight display tracking, tabular numerals. Facts are set as label/value rows with hairline dividers; one closing band commits the primary color at full width.

STORY: Visitor meets a human greeting, reads the ficha, scans services as a list, opens only the doubts they have, and creates an account.

FIRST VIEWPORT: Sticky translucent nav (logo, anchors, Iniciar sesión, Crear cuenta). Greeting title at 3–3.5rem with one supporting line and the primary action, left-aligned. Below, a 7/5 grid: the ficha card (initials, name, specialty, then rows) and the contact card with live open/closed status, address, Cómo llegar, WhatsApp, phone, email. The ficha must start inside the first viewport at 1440×900.

FORM: Ficha del consultorio, position 5 on the ordered list, seed key 107a0d42. Signature interaction: live "Abierto ahora / Cerrado · abre…" status computed in the practice's time zone; FAQ as native disclosure with animated height.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
