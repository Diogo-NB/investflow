# DESIGN.md - InvestFlow Web

## Context

- Artifact: authenticated investment workspace with an offer catalog.
- Primary outcome: enter through Keycloak, then create, consult, edit, and remove
  offer terms without losing input or misunderstanding rates.
- Positioning: approachable personal finance. Adjectives: precise, calm,
  approachable. Aesthetic essence: clear, grounded, ready.
- Approved direction: Minimal Product Workspace, light theme only, Tailwind v4
  with Base UI interaction primitives and locally hosted IBM Plex Sans, built
  with React + Vite. The offer catalog screens are being rebuilt (2026-10-10);
  audit entries before that date record the visual outcome they must reproduce.
- References: [Nord](https://nordhealth.design/) for restrained application
  spacing and surface hierarchy; [IBM Plex](https://www.ibm.com/plex/) for
  legible functional typography. Use their principles, not their components.
- Constraints: Portuguese copy, WCAG 2.2 AA, no external font requests, no
  decorative imagery, no fictitious charts/data/actions, no dark-mode toggle.

## Aesthetic and layout

The compact white header establishes the workspace on an off-white canvas.
Identity and logout stay together; content is left-aligned on the same rail.
One horizontal rule extends the small route label across available space.
The signature is the lowercase green `if` brand square, aligned with the
wordmark and the content rail. One navigation card per section (simulations,
offers) follows the welcome copy, each led by its aggregate icon. No nested
surfaces or gradients.

- Container: 72rem maximum, with 24px mobile and 40px larger-screen gutters.
- Header: at least 80px; wraps naturally when wordmark and identity need room.
- Main: 24px top spacing on mobile and 40px at the 640px breakpoint. The welcome
  page adds 24px/40px internally to preserve its original generous spacing.
- Welcome: 40px/56px between its route label and content, then 16px between
  heading and supporting copy. Copy measure is at most 65ch.
- Responsive: mobile-first; no fixed viewport-dependent content heights.

## Typography

IBM Plex Sans is used for display and body text. A single approved functional
family suits this small application; weight and size establish hierarchy.
Weights 400, 500, and 600 ship as local Latin WOFF2 assets, including Portuguese
characters, with `font-display: swap`. Source: Fontsource's IBM Plex Sans 5.3.0
asset distribution; license: Open Font License in `public/fonts/OFL.txt`.
No font package is added to the workspace dependencies.

Scale: Major Third, ratio 1.25, base 16px; the small label is a deliberate 14px
utility step. Body line-height is 1.5 to 1.625; headings use 1.25.

| Role                       | Size      | Weight     |
| -------------------------- | --------- | ---------- |
| Label                      | 14px      | 400 or 500 |
| Body                       | 16px      | 400        |
| Supporting copy / wordmark | 20px      | 400 / 600  |
| Section heading            | 25px      | 600        |
| Mobile welcome heading     | 31.25px   | 600        |
| Desktop welcome heading    | 39.0625px | 600        |

## Color

Neutrals carry most of the interface; muted green identifies the brand and
interactive focus. State colors are paired with text. Palette values are authored
in OKLCH; the hex equivalents document the intended sRGB colors.

| Role              | OKLCH                  | Hex       |
| ----------------- | ---------------------- | --------- |
| Background        | `0.9741 0.0034 145.55` | `#f5f7f5` |
| Surface           | `1 0 0`                | `#ffffff` |
| Foreground        | `0.2776 0.0162 176.59` | `#202b28` |
| Muted text        | `0.497 0.0194 162.17`  | `#59665f` |
| Border            | `0.9015 0.0118 162.02` | `#d8e1dc` |
| Accent / success  | `0.4567 0.0802 164.05` | `#22654b` |
| Accent foreground | `1 0 0`                | `#ffffff` |
| Accent container  | `0.9527 0.0124 157`    | `#e9f2ec` |
| Warning           | `0.5027 0.0968 77.98`  | `#825c14` |
| Warning container | `0.9648 0.0283 86.6`   | `#fcf3de` |
| Error             | `0.4984 0.1543 27.96`  | `#a9342c` |
| Error container   | `0.9589 0.0188 22.3`   | `#feedec` |

State containers tint status cards and tags: progress and success use the
accent container, "Requer ação" and "Desatualizado" the warning container,
"Falha técnica" and save failures the error container, each with a border of
its state color at reduced opacity and its title in the state color. Body text
on them stays the foreground color.

## Spacing, surfaces, and controls

- Base spacing increment: 4px; favor 8px multiples for related regions.
- Radius: 4px controls/brand mark; 8px primary surfaces.
- Elevation: defined edges only. No diffuse shadows or nested cards.
- Default control density. Product actions have at least 44px targets.
- Logout: secondary text action with token-based hover/active feedback. Pending
  logout disables the action and displays `Saindo…`; failure exposes a useful
  Portuguese alert and allows retry.
- Bootstrap: visible `Iniciando sua sessão…` status, then the authenticated shell
  or a safe error and one reload action. The recovery action uses native HTML
  because the UI framework has not rendered.
- Keyboard: skip link, wordmark link, logout/retry. Focus uses a 2px accent outline
  with separation; the skip target is the main landmark.
  The main landmark receives route/skip-link focus without a browser outline;
  interactive controls keep their visible focus indicators.
- Dropdowns use the Base UI Select for triggers and popups, with 8px
  horizontal trigger padding inside the field inset. Focus is shown by the
  outer field border, without an inner text outline.
- Welcome entries: one bordered link card per section, side by side from
  1024px. The aggregate icon on a 48px accent tile leads the heading, copy,
  and a textual action with an arrow. On hover the border turns accent, the
  tile fills with the accent, and the arrow moves 4px right.
- Header navigation: each section link shows its aggregate icon beside the
  label; the current section sits on the accent container.
- Page titles: the aggregate's icon on a 40px accent tile beside the heading
  and its supporting line. The route label repeats the icon at 16px.
- Empty states: the aggregate's icon on a 56px accent tile beside the copy and
  its actions. Loading lists show their status text above three placeholder
  rows (an icon tile and two bars) that pulse.
- Actions carry an icon before their label: plus for creation ("Salvar como
  oferta"), pencil for "Editar", copy for "Duplicar", trash for "Excluir",
  search for "Buscar", x for "Limpar filtros", refresh for "Recarregar",
  chevrons for pagination and going back ("Voltar à oferta"), and an arrow
  for "Ver todas" and "Aplicar à oferta". Pending actions swap their icon for the spinning refresh icon.
- List: compact heading and primary creation action; issuer search/title filter
  above one white result surface. Desktop table uses horizontal separators and
  right-aligned tabular figures. Below 1024px, labeled offer rows replace it.
- Detail: grouped definition list, exact terms, and a secondary identifier.
  Edit is primary; delete is quiet until its confirmation dialog.
- Editor: one white surface, three fieldsets separated by horizontal rules,
  two-column fields above 640px and one column below. Labels remain visible;
  validation appears after touch/submission and retains entered values.
- Vencimento: calendar popup (react-day-picker in a Base UI Popover) with Portuguese controls and a visible SVG
  calendar toggle; typed dates use DD/MM/AAAA. Business-date pickers show
  weekends and holidays disabled with react-day-picker's reduced opacity. The form/API retain YYYY-MM-DD
  civil dates. Picker and input are disabled while saving.
- Rates: show contracted percentages with kind-specific units and a textual
  preview. Changing kind clears the rate to avoid carrying different units.
- Simulation list: compact heading and primary "Nova simulação"; one white
  result surface with the net value at maturity right-aligned in tabular
  figures and a status tag ("Calculando" with a spinning icon, "Requer ação",
  "Falha técnica", "Desatualizado") with an icon and text on its state
  container.
- Simulation workspace: an inputs surface (about 26rem, sticky on desktop)
  beside the results. "Oferta" comes first: the offer picker, then the
  terms as always-editable fields. Own terms show "Termos próprios" in the
  picker, a muted line led by the split icon ("Baseados em …"), and, below
  the terms, their three
  secondary actions; changed terms add one consequence line with the info
  icon in muted text. "Investimento" (principal,
  investment date, curve) follows below a rule, with "Salvar e calcular"
  and a hint saying what saving does last. Results lead with the net value,
  then a definition list of amounts; the balance evolution (month rows that
  expand to their business days on a background-colored band) is a native
  disclosure. Rejections use the error token and also mark the responsible
  field; staleness uses the warning token with text.
- Tax explanation: a short scrollable Dialog (max 36rem) opened by a quiet
  text action with an inline SVG info icon under the result amounts. One
  section per tax separated by rules: a one-line rule, the filled-in formula
  in a background-colored block with tabular figures, and the table with the
  applied row in the accent container plus a "seu caso" label.
- Dialogs: Base UI Dialog/AlertDialog focus management and 8px token radius; cancel first.
  Delete confirmation uses the existing error token for its primary action.
- Pending operations disable repeat actions; loading, empty, filtered-empty,
  failure/retry, missing-record, and success states include useful text.

## Motion, iconography, imagery, and dark mode

Motion is limited to state feedback and short, quiet transitions, with no
ripple effects, bounces, or page-entry transitions:

- A refresh icon spins while work is in progress: "Calculando" (workspace
  card and list tag) and "Salvando…", and on "Tentar novamente" while it is
  being requested.
- Status cards and a newly arrived result fade in (`animate-fade-in`, 300 ms,
  a 4px rise), replayed when the status or the result's `calculatedAt`
  changes.
- While a recalculation is pending, the previous figures recede to 60%
  opacity.
- List results, empty states, an offer's terms, and the impact notice fade in
  the same way when they arrive; a list replays it for each new page or
  filter, never on a background refetch. The welcome cards fade in 80 ms
  apart.
- Dialogs, select popups, and the calendar popover fade and scale in from 95%
  over 150 ms (Base UI's starting and ending styles); a select's caret turns
  while it is open.
- Hover feedback is a 150–200 ms color transition on rows, links, and cards,
  plus the icon movements described above. Loading placeholders pulse.

All animation is `motion-safe:`, and the global reduced-motion reset also
zeroes durations; a still refresh icon keeps its meaning.

Icons are inline SVGs in `libs/investment-simulator/web/src/lib/ui/icons.tsx`
(20px grid, 1.6 stroke, `currentColor`, `aria-hidden`). They accompany text
and never carry state alone. There is no icon package, icon font,
illustration asset, or dark theme. The brand square is text and CSS, not an
image.

Each aggregate has one canonical icon, used wherever the aggregate appears
(navigation, page titles, route labels, fields that choose it, list rows, and
empty states) and never for anything else:

| Aggregate  | Icon                          |
| ---------- | ----------------------------- |
| Simulation | calculator (`SimulationIcon`) |
| Offer      | price tag (`OfferIcon`)       |
| Curve      | chart curve (`CurveIcon`)     |

A new aggregate (portfolios, for example) gets its own icon here before it
ships. The other icons are state icons (refresh, check circle, alert
triangle, x circle), action icons (plus, pencil, copy, trash, search, x,
arrow, chevrons), and the info and calendar icons. The app receives the
section icons through the context's `investmentSimulatorSections`; its welcome
card arrow is a local copy of the arrow icon.

## Accessibility

Body and muted text, accent controls, and error messages must reach 4.5:1 against
their backgrounds; large text requires 3:1. Border is a decorative separator,
not the sole indicator of an interactive control. Preserve semantic landmarks,
a single welcome heading, visible keyboard focus, a skip link, full identity
text for assistive technology despite visual truncation, and live status/alerts.
Validate reflow at 320px and 200% zoom. No meaning depends on color alone.

## Tokens

These are the visual source of truth, projected into Tailwind's CSS theme.

```css
@theme {
  --color-*: initial;
  --radius-*: initial;
  --font-body: 'IBM Plex Sans', sans-serif;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5625rem;
  --text-2xl: 1.953125rem;
  --text-3xl: 2.44140625rem;
  --spacing: 0.25rem;
  --radius-control: 0.25rem;
  --radius-surface: 0.5rem;
  --color-bg: oklch(0.9741 0.0034 145.55);
  --color-surface: oklch(1 0 0);
  --color-fg: oklch(0.2776 0.0162 176.59);
  --color-muted: oklch(0.497 0.0194 162.17);
  --color-border: oklch(0.9015 0.0118 162.02);
  --color-accent: oklch(0.4567 0.0802 164.05);
  --color-accent-fg: oklch(1 0 0);
  --color-accent-soft: oklch(0.9527 0.0124 157);
  --color-success: oklch(0.4567 0.0802 164.05);
  --color-warning: oklch(0.5027 0.0968 77.98);
  --color-warning-soft: oklch(0.9648 0.0283 86.6);
  --color-error: oklch(0.4984 0.1543 27.96);
  --color-error-soft: oklch(0.9589 0.0188 22.3);
  --animate-fade-in: fade-in 300ms ease-out;
}
```

`apps/web/src/styles.css` owns these tokens, the Tailwind import, font faces, and
reset. Templates and host metadata use semantic utilities such as `bg-surface`,
`text-muted`, `text-accent`, and `rounded-control`; default Tailwind color/radius
namespaces are cleared. No component stylesheets are needed.

Base UI primitives are unstyled and use the same semantic utilities, so no
theme bridge or component stylesheet is needed. `styles.css` also owns the
global `:focus-visible` outline and the reduced-motion reset.

## Audit

2026-10-06, control refinements: the main landmark retains programmatic focus
without the browser outline; interactive controls retain visible focus. All
offer dropdowns have consistent inset padding. The Portuguese date
picker passes calendar selection, manual/invalid entry, focus, pending disablement,
and preservation after failed save. Dates round-trip through the widget and HTTP
payload in America/Sao_Paulo and Pacific/Kiritimati. Browser checks cover existing
edit dates, 320–1440px reflow, 200% zoom, and axe A/AA checks. The frontend suite
now has 45 context and 30 app tests.

2026-10-06, offer CRUD: all workspace lint, test, and production build targets
pass. There are 36 context frontend tests and 30 app authentication/routing tests;
the infrastructure suite passes 61 tests with four existing integration tests
skipped. The production initial bundle is 414.46 kB, below its 500 kB warning
budget. API pruning excludes browser dependencies.

Chromium checks pass at 320, 375, 768, and 1440 pixels and 200% zoom for the home,
list, create, detail, edit, and delete-dialog layouts. Checks cover route focus,
dialog keyboard/Escape behavior, reduced motion, filter history, stale pages,
invalid input, unsaved-change confirmation, write failure/retry, exact rates,
immutable identification, and missing/deleted records.
Axe-core reports no WCAG A/AA violations across these screens and their checked
error/confirmation states; this does not establish full WCAG conformance.

CRUD browser checks use temporary mocked OIDC authorization/ID responses with a
real Keycloak-issued access token and the real JWT-protected API. Creation,
PATCH, reload/direct links, soft deletion, query validation, and bearer handling
pass. Only temporary test offers were created/deleted; the existing active
catalog and identity accounts were preserved. The real user-login limitation
recorded below still applies.

2026-10-06: source review, workspace checks, 29 frontend unit tests, and production
compilation pass. Chromium checks pass at 320, 375, 768, and 1440 pixels, including
200% zoom, keyboard navigation, visible focus, reduced motion, and local fonts.
Automated axe-core WCAG A/AA checks report no violations on the welcome and
authentication recovery views; this does not establish full WCAG conformance.
Browser checks with temporary mocked OIDC responses pass for PKCE, welcome,
reload, logout, initialization failure, and retry. Real Keycloak accepts the
documented local credentials, then requires first-login profile and password
setup. That account was left unchanged, so the real authenticated return remains
unverified until setup is completed.

## Changelog

- 2026-10-31: the workspace's "Oferta" section shows the terms as fields,
  with the own-terms line, a consequence line, and icons on its actions; the
  workspace description drops the removed calculation history and the old
  "Termos do título" and "Calcular" labels.

- 2026-10-12: calculation status gets color, icons, and motion. Added warning
  and error containers, an inline SVG icon set, a spinning refresh icon for
  in-progress work, a fade-in for status changes and new results, and colored
  list status tags. Text on the new containers keeps at least 5.4:1. Replaces
  the earlier "no animated status indicators, no icon set" rule.

- 2026-10-10: rebuilt the shell and welcome page in React + Vite and moved
  interaction primitives to Base UI. The welcome page has no feature cards until
  the offer catalog is rebuilt. Tokens, typography, layouts, and states are
  unchanged.

- 2026-10-06: added the offer entry card and catalog CRUD layouts, form states,
  responsive offer rows, exact percentage presentation, and confirmation dialogs.
  Kept the approved workspace identity and dependency versions.

- 2026-10-06: replaced Calm Ledger with the approved light workspace direction,
  self-hosted IBM Plex Sans, green semantic tokens, themed interaction components, and an
  auth-only welcome page. Removed the connectivity screen and decorative balance
  marker. The installed toolchain remains unchanged.
