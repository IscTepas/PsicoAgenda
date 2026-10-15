---
name: PsicoAgenda
description: Agenda and clinical record for one psychology practice; a quiet white-and-teal world for patients and their psychologist.
colors:
  primary: "oklch(0.51 0.096 184)"
  primary-foreground: "oklch(0.985 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  border: "oklch(0.922 0 0)"
  sidebar: "oklch(0.985 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  chart-1: "oklch(0.7 0.11 184)"
  chart-2: "oklch(0.62 0.09 200)"
  chart-3: "oklch(0.55 0.08 160)"
  chart-4: "oklch(0.72 0.12 150)"
  chart-5: "oklch(0.45 0.07 190)"
  brand-psico: "#00386e"
  brand-agenda: "#20a689"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.025em"
  body-lg:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  value:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.375
    fontFeature: "tnum"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
  full: "9999px"
spacing:
  row: "16px"
  card: "24px"
  card-lg: "32px"
  gutter: "24px"
  section: "80px"
  section-lg: "96px"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.label}"
  button-primary-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    padding: "0 20px"
    height: "44px"
  button-primary-sm:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "8px 14px"
    height: "40px"
  surface-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.card}"
  surface-card-hero:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.3xl}"
    padding: "{spacing.card-lg}"
  status-pill:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    typography: "{typography.caption}"
  segmented-control:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.xl}"
    padding: "4px"
  segmented-control-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  initials-avatar:
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    size: "56px"
---

# Design System: PsicoAgenda

## Overview

**Creative North Star: "The Consulting-Room Ledger"**

PsicoAgenda is a white room with one green voice. The ground is pure white, text is near-black, and everything structural (bands, borders, chips, the segmented track) is a neutral grey. The single teal primary is the practice's signature: it marks the next action, live state, links, and a person's initials, and almost nothing else. The world reads as calm, orderly, and confidential, closer to a well-kept clinic file than to a SaaS dashboard.

Information is set as a ledger: label on the left in muted grey, value on the right in medium-weight ink with tabular numerals, rows separated by hairline dividers. Surfaces are generously rounded (18-22px) white cards with a hairline border, sitting on white or on a pale neutral band. Depth is almost entirely tonal; shadows are whisper-light and appear only where a surface must lift (the home ficha card, dialogs, the selected segment).

The same system serves two audiences. Patient-facing pages (home, auth) stay sparse and warm, with larger type and fewer words. The psychologist's app is denser, built from the same cards, rows, pills, and teal accent at smaller sizes. The user has made the white/green base binding across every screen.

**Key Characteristics:**
- White ground, near-black ink, neutral grey structure, one teal accent.
- Label/value rows with hairline dividers as the default way to present facts.
- Rounded white surfaces (14px controls, 18-22px cards) with hairline borders.
- Geist sans throughout, tight negative tracking on headings, tabular numerals on every time, count, or phone number.
- Status shown with a neutral pill and a small colored dot, never a filled colored badge.
- Motion is short and functional (150ms state changes, 320ms disclosure, scroll-linked reveals on the home page), and off under reduced motion.
- Touch responds on press: every link, button and summary drops the browser's tap delay and tap flash, and shows its own active fill the moment it is pressed.

## Colors

A monochrome white-and-grey world with a single mid-dark teal carrying all brand and action meaning. All values are OKLCH in `src/app/globals.css`, which is the normative source.

### Primary
- **Consultorio Teal** (`primary`): primary buttons, active sidebar item, links ("Escríbenos", "Ver agenda"), inline icons in contact rows, the live/open dot, today's date in the calendar, and the full-width closing band on the home page. Tinted at 10% it becomes the initials-avatar fill and the success notice background; at 4% it marks the "next" row in a list. Dark theme lifts it to `oklch(0.65 0.12 184)`.
- **Primary Foreground** (`primary-foreground`): text and icons on teal.

### Wordmark
- **Psico Navy** (`brand-psico`, `#00386e`) and **Agenda Green** (`brand-agenda`, `#20a689`): the two colors of the original logo's lettering, measured from `public/images/psicoagenda-logo.png`. They are used only for the word "PsicoAgenda" next to the icon, through the `Wordmark` component (`src/components/brand/wordmark.tsx`, bold), never as UI colors. Dark theme lightens them to `#8db4e2` and `#3cc4a4` so the word stays legible.

### Neutral
- **Clinic White** (`background`, `card`): page ground and card surfaces. Cards are distinguished from the ground by border, not by tint.
- **Ink** (`foreground`): headings and values.
- **Soft Ink** (`secondary-foreground`): text on secondary/accent surfaces.
- **Waiting-Room Grey** (`muted`): section bands (at 40-60%), status pills, segmented-control track, hover fill for ghost and outline controls.
- **Note Grey** (`muted-foreground`): labels, supporting copy, timestamps, inactive nav.
- **Hairline** (`border`, also `input`): every divider, card border, and field stroke. Commonly softened to 60% for page-level rules (header, section tops).
- **Sidebar Paper** (`sidebar`): app sidebar ground, one step off white.

### Signal (functional, not brand)
- **Destructive Red** (`destructive`): errors, invalid fields, cancelled status dot, cancel hover.
- **Pending Amber** (Tailwind `amber-500` dot, `amber-700` text, `amber-100` fill): the one recurring non-token hue; reserved for "Por confirmar" and "Falta registrar" states in the dashboard.
- **Chart teals** (`chart-1` to `chart-5`): a teal-to-green family around hue 150-200 for reports; they stay inside the brand hue band.

### Named Rules
**The White-and-Green Rule.** Every screen keeps the white ground and the teal primary as its only brand color. No second accent hue is introduced; signal colors (red, amber) appear only to report state. This is a user-confirmed brand commitment.

**The One Voice Rule.** Teal marks what to do next or what is live. If a teal element is neither an action, a link, a live state, nor a person's initials, it should be grey.

## Typography

**Display Font:** Geist (via `next/font`, variable `--font-sans`; fallback `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Geist
**Mono Font:** Geist Mono (`--font-geist-mono`), available but not used in shipped UI.

**Character:** One neo-grotesque family at every level. Hierarchy comes from size, weight (400/500/600 only), and tracking that tightens as size grows, not from a second face.

### Hierarchy
- **Display** (600, 2.25rem mobile to 3rem `sm` to 3.5rem `md`, line-height 1.05, tracking -0.035em, `text-balance`): the home greeting only.
- **Headline** (600, 1.875rem, tracking -0.025em): section titles on the home page and the closing band. App greetings use 1.5-1.875rem with `tracking-tight`.
- **Title** (600, 1.25rem, tracking-tight): person names in the ficha and the dashboard focus card.
- **Title Small** (600, 1.125rem, tracking-tight): service names, dialog titles, card section headings.
- **Body Large** (400, 1.125rem, line-height 1.625, muted): the one supporting line under the display greeting.
- **Body** (400, 1rem, line-height 1.625, muted for supporting text): paragraphs, capped at `max-w-prose` (65ch) or `max-w-xl`.
- **Value** (500, 15px, line-height 1.375, tabular numerals): the right-hand side of a label/value row; contact values.
- **Label** (400, 0.875rem, muted): the left-hand side of a label/value row, field labels (500), nav links.
- **Caption** (500, 0.75rem): status pills, segmented-control options, calendar day numbers. Sub-caption sizes (10-11px) appear only in dense app chrome.

### Named Rules
**The Tabular Rule.** Times, dates, counts, phone numbers, and durations always use tabular numerals so columns and countdowns do not jitter.

**The Tighten-With-Size Rule.** Tracking is -0.035em at display, -0.025em at headline and title, normal at body and below. Labels are sentence case in grey; no screen uses uppercase tracked labels.

## Layout

Content sits in a centered container of 72rem (`max-w-6xl`) with 24px side padding, on both the public home and the psychologist dashboard; the patient dashboard narrows to 56rem. The home page stacks full-width bands, each with the container inside: white, then a hairline rule (`border-t` at 60%) and white, then a pale grey band (`muted` at 40%), then the full teal closing band. Section padding is 80px vertical, 96px from `md`.

Two-column compositions use a 12-column grid from `lg`: a 4/8 split for "heading + list" sections and a 7/5 split for the home ficha and contact card. The dashboard uses `minmax(0,1fr) 300px`. Below `lg` everything collapses to one column; dense app rows reflow by container queries (`@container`, `@lg`, `@2xl`, `@3xl`) rather than viewport width.

Inside cards the rhythm is 24px padding (32px from `sm` on hero cards), 16px row padding in label/value lists, 24px between a card's header block and its rows. Label columns in ficha rows are a fixed 9rem from `sm`.

Headers are sticky, 64px tall on the home page and 56px in the app. The home header is a translucent material (`background` at 75%, `backdrop-blur-xl`, `backdrop-saturate-150`) whose 60% hairline bottom border is a scroll edge: invisible at the top of the page and fading in over the first 48px of scroll (`.scroll-edge`). It turns solid under `prefers-reduced-transparency` and gains an ink border under `prefers-contrast: more` (`.material`). The app header uses the same material and scroll edge at 56px. Anchor targets carry `scroll-mt-16` to clear the header. Patient app on mobile uses a fixed 64px bottom tab bar.

## Elevation & Depth

Flat by default. Depth comes from tone (white card on a grey band, grey pill on white) and from hairline borders. Shadows exist but are kept near the threshold of visibility, and each has a specific job.

### Shadow Vocabulary
- **Hairline lift** (`box-shadow: 0 1px rgb(0 0 0 / 0.05)`, Tailwind `shadow-2xs`): primary and outline buttons.
- **Selected segment** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`, `shadow-xs`): the selected option of a segmented control and the active sidebar item.
- **Ficha float** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.08)`): the home page's ficha card, the one surface that should read as a document lifted off the page.
- **Auth card** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`, `shadow-sm`): the centered card on login, registro, and recuperar.
- **Dialog** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`, `shadow-xl`): modal dialogs over a 40% black overlay with a light blur.

### Named Rules
**The Flat-By-Default Rule.** Cards in lists and app panels carry a border and no shadow. A shadow is earned by a surface that is singular on its screen (the ficha, the auth card, a dialog) or by a selected state.

## Shapes

Soft, generous rounding on a 10px base (`--radius: 0.625rem`), scaled by multipliers: controls (buttons, inputs, nav items, list hover rows) at 14px; small buttons and segments at 10px; content cards and grouped lists at 18px; hero surfaces (home ficha and contact card) at 22px; the centered auth cards (login, registro, recuperar) at 26px (`rounded-4xl`). Anything that represents a person or a state (initials avatars, status pills, dots, service modality chips, calendar days) is fully round.

Borders are always 1px hairlines in the `border` token. Grouped content (FAQ, appointment lists) sits in one rounded, `overflow-hidden` container with internal `divide-y` hairlines rather than as separate cards. Corners are never sharp and never mixed within one surface.

## Components

### Buttons
Quiet and solid; they press down slightly rather than glow.
- **Shape:** gently rounded (14px), 40px tall by default; `lg` 44px with 20px padding and 16px text; `sm` 32px with 10px radius and 12px text; `pill` variant fully round.
- **Primary:** teal fill, white text, 14px medium, hairline lift shadow. Hover drops to 90% opacity of the teal.
- **Outline:** white card fill, hairline border, ink text; hover fills with `muted`.
- **Ghost:** transparent; hover fills with `muted`. Used for secondary actions beside a primary ("Ya tengo cuenta", "Iniciar sesión" in the nav).
- **On teal:** inside the teal band, the primary action inverts to a white button with ink text.
- **Hover / Focus / Active:** 150ms transitions; focus shows the ring token at 40% as a 3px ring plus a ring-colored border; active scales to 0.98. Icons are 16px Lucide strokes, trailing for forward motion (arrow right, arrow up-right for external).

### Chips and Status Pills
- **Status pill:** neutral `muted` (70%) fill, fully round, 12px medium ink at 80%, with a 6px colored dot before the label (teal confirmed, amber pending, red cancelled, grey completed or no-show).
- **Modality chip (home services):** `muted` fill, fully round, 12px medium, no dot.
- **"Siguiente" marker:** the one filled teal pill, 10px semibold, used to flag the next appointment in a list.

### Cards / Containers
- **Corner Style:** 18px for app and list cards, 22px for home hero surfaces.
- **Background:** white `card`; companion panels use `muted` at 60% with no border (home contact card).
- **Shadow Strategy:** none at rest; see Elevation for the three singular exceptions.
- **Border:** 1px `border` hairline.
- **Internal Padding:** 20-24px, 32px on hero cards from `sm`.

### Label/Value Rows (signature)
The ledger. A `dl` with a top hairline and `divide-y` between rows; each row is 16px vertical padding, label in 14px `muted-foreground`, value in 15px medium ink with tabular numerals. From `sm` the label occupies a fixed 9rem column; on mobile it stacks above the value. Inside dialogs the same pattern sits on a `muted` 40% rounded block with label and value justified apart.

### Inputs / Fields
- **Style:** white `card` fill, 1px `input` hairline, 14px radius, 40px tall, 14px horizontal padding, 14px text, grey placeholder.
- **Focus:** border turns teal and a 3px teal ring at 20% appears.
- **Error / Disabled:** invalid fields take a red border and 3px red ring at 20%; messages are 14px medium red below the field. Disabled is 50% opacity.
- **Labels:** 14px medium ink above the field, 8px gap.

### Segmented Control
A `muted` track with 4px padding and 14px radius; options are 12px medium grey text. The selected option becomes a white surface with ink text and the selected-segment shadow. Selection is marked by surface, not by color; counts sit beside labels in tabular grey.

### Navigation
- **Public header:** sticky translucent white bar, icon logo (40x35) plus the `Wordmark` at 18px, section anchors as 14px grey links with 10px-radius `muted` hover, ghost "Iniciar sesión" and primary "Crear cuenta" at `sm` size. Anchors hide below `md`.
- **App sidebar:** 240px (72px collapsed), translucent `card` material, icon plus the `Wordmark` at 15px (the word hides when collapsed), items 14px medium with 18px icons and 14px radius, at least 40px tall; the active item is a teal fill with white text and stays active on the section's subpages (`/agenda/nueva` keeps Agenda selected). On desktop it is sticky at full viewport height so it never scrolls away. The footer is the signed-in person (initials avatar, name, role) and links to Perfil.
- **Mobile drawer:** the same sidebar slides in over a 40% black scrim that fades with it (300ms, `cubic-bezier(0.32, 0.72, 0, 1)`). It tracks a horizontal drag 1:1 after a 10px threshold, rubber-bands when pulled outward, and closes when the drag projected by its release velocity passes half its width. Escape and a tap on the scrim also close it; the page behind does not scroll while it is open.
- **Mobile tab bar:** fixed bottom material, 64px plus the safe-area inset, 10px labels under 20px icons; the active item is teal text with a heavier icon stroke; a press dims the item to 60%.

### Initials Avatar
Fully round, teal at 10% fill, teal semibold initials. Sizes: 32px (sidebar, inline), 36px (list rows), 48px (dashboard focus), 56px (home ficha). Closed or past items switch to `muted` fill with grey initials. It stands in for a portrait until real photos exist.

### Live Status Indicator
An 8px dot before a short status line. When live (open now, session in progress) the dot is teal with a teal `animate-ping` halo at 50-60% opacity, the label is teal medium, and the detail follows in grey after a middle dot ("Abierto ahora · hasta las 7:00 p.m."). When idle the dot is grey at 50% and the label is ink. The halo is hidden under reduced motion. A fixed-height placeholder holds space until hydration so nothing shifts.

### Disclosure (FAQ)
Native `details` items inside one rounded 18px bordered card, divided by hairlines. The summary is 16px medium ink with a trailing 16px plus icon that rotates 45 degrees to an x when open (300ms ease-out). With motion allowed, the content height animates over 320ms with `cubic-bezier(0.16, 1, 0.3, 1)`; with reduced motion it simply opens. Hover and focus fill the summary with `muted` at 40%.

### Dialog
Centered, max 32rem, white `background`, 18px radius, 80% hairline border, 24px padding, dialog shadow over a 40% black overlay. Title 18px semibold tight; description 14px grey. Footer actions right-aligned from `sm`, stacked reversed on mobile: ghost dismiss, then outline, then the primary.

## Do's and Don'ts

### Do:
- **Do** keep white `background` as the ground and `primary` teal as the only brand color on every screen.
- **Do** present facts as label/value rows: 14px grey label, 15px medium ink value, tabular numerals, hairline dividers.
- **Do** show appointment and practice status as a neutral pill or line with a small colored dot.
- **Do** mark selection in segmented controls with a white surface and a faint shadow, not with teal.
- **Do** use the radius scale: 14px controls, 18px cards, 22px hero surfaces, full round for people and states.
- **Do** use initials avatars (teal at 10%, teal initials) wherever a person appears without a photo.
- **Do** gate decorative motion (smooth scroll, disclosure height, ping halos, `.reveal`) behind `prefers-reduced-motion: no-preference`.
- **Do** reveal home sections with `.reveal`: a 16px rise and fade driven by `animation-timeline: view()`, finishing when the block is 90% inside the viewport, so it follows the scroll and reverses with it. Never on content in the first viewport.
- **Do** build tappable lists as an inset grouped list: white card, hairline dividers, rows at least 48px tall that fill with `muted` on press, and a trailing chevron (or an up-right arrow for external links).
- **Do** let forward arrows hint their direction: 2px nudge on hover, 200ms ease-out.

### Don't:
- **Don't** introduce a second accent hue or recolor the base; emerald, blue, or violet accents break the white/green commitment.
- **Don't** use filled colored badges for status; the dashboard's neutral pill plus dot is the system.
- **Don't** add shadows to cards in lists or panels; borders and tone carry depth.
- **Don't** use uppercase tracked labels or eyebrow text above headings; labels are sentence case in grey.
- **Don't** set times, counts, or phone numbers in proportional numerals.
