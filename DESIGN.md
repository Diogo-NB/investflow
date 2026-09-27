# DESIGN.md - InvestFlow Web

## Context (from discovery)

- Artifact type: SaaS application.
- Positioning: trustworthy consumer finance with a restrained technical edge.
- Audience: people beginning an investment simulation. Primary action: confirm
  that the simulator service is available.
- Adjectives: calm, precise, trustworthy, direct.
- Visual word translations: calm uses open space and low-chroma surfaces;
  precise uses aligned rules and compact labels; trustworthy uses deep blue and
  serif display type; direct keeps one state and one recovery action in view.
- Aesthetic essence: calm, financial, exact.
- Single-minded proposition: InvestFlow makes the next investment step feel
  understandable and dependable.
- References: financial ledgers for rules and hierarchy; Material 3 for familiar
  controls. Avoid generic startup gradients and card grids.
- Mode: light. Density: balanced.
- Constraints: Angular Material's Azure Blue prebuilt theme, no external fonts,
  no icon font, WCAG 2.2 AA, an authenticated application shell, and a single
  API-connectivity screen.

## Aesthetic

- Direction: Calm Ledger, an editorial and Swiss-influenced application shell.
- Defining trait: text and horizontal rules carry hierarchy instead of a grid of
  decorative cards.
- Signature move: an asymmetric balance marker made from three ruled amounts
  sits beside the live service state.

## Typography

- Display: Iowan Old Style with Palatino and Georgia fallbacks. These are local
  system faces with no network request.
- Body: Aptos with Trebuchet MS and sans-serif fallbacks. These are local system
  faces with no network request.
- Scale: Major Third, ratio 1.25, base 16px. Display 49px/1.05, h1 39px/1.1,
  h2 25px/1.2, body-large 20px/1.5, body 16px/1.6, small 13px/1.45.
- Weights: 400, 600, 700. Measure: 62ch. Display tracking: -0.015em.

## Color

- Strategy: Azure blue is appropriate for financial trust and required by the
  Material theme. A green success accent is reserved for verified state.
- Distribution: 60 neutral / 30 blue brand / 10 semantic accent.
- Palette:
  - bg: `oklch(0.975 0.012 238)` | `#f2f8fc`
  - surface: `oklch(0.995 0.003 240)` | `#fdfefe`
  - fg: `oklch(0.24 0.035 248)` | `#172b3b`
  - muted: `oklch(0.47 0.035 248)` | `#566b7c`
  - border: `oklch(0.84 0.035 235)` | `#c2d5e1`
  - accent: `oklch(0.48 0.14 245)` | `#1769a8`
  - accent-fg: `oklch(0.99 0.002 240)` | `#fbfdff`
  - success: `oklch(0.43 0.11 155)` | `#247547`
  - warning: `oklch(0.55 0.13 70)` | `#99621b`
  - error: `oklch(0.49 0.18 28)` | `#ae3f35`

## Spacing, radius, shadow

- Spacing base: 8px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radius: 4px for small elements and 12px for primary surfaces.
- Shadow approach: defined edges only. Do not combine borders with diffuse
  elevation shadows.

## Layout and composition

- Grid: asymmetric two-column editorial layout with 24px to 64px fluid gutters.
- Spacing rhythm: 8px within labels, 24px within groups, 48px between regions.
- Signature layout move: the narrow ruled balance marker occupies the secondary
  column and collapses beneath the state on small screens.
- Density: balanced. Scanning: F-pattern.
- Responsive: mobile-first, with a content-driven breakpoint at 720px.

## Components and states

- Button hierarchy: one Material flat retry action. Hover and active feedback
  come from Material; focus adds a 3px blue ring; loading disables repeat work.
  The shell uses a secondary Material text action for `Sair`, positioned beside
  the authenticated identity and disabled while logout is pending.
- Inputs, tables, and overlays: not present in the initial screen.
- Loading: short indeterminate spinner plus explicit text and a polite live
  region. Success: label and returned message. Error: plain explanation and a
  retry button in an assertive live region. Authentication initialization and
  logout failures use concise Portuguese messages, never raw provider errors.
- Focus ring: 3px `box-shadow` in the accent color with 2px separation.

## Motion

- Duration scale: 100ms, 150ms, 200ms, 300ms, 500ms.
- Easing: enter `cubic-bezier(0.23, 1, 0.32, 1)`; movement
  `cubic-bezier(0.77, 0, 0.175, 1)`.
- Only direct-feedback transforms and state opacity may transition. The
  indeterminate loading spinner is hidden when reduced motion is requested; its
  text remains visible.

## Iconography

- No icon set is used. Status meaning is expressed with text and geometry.

## Imagery and illustration

- No imagery is needed. The balance marker is a CSS layout device, not an
  illustration. Avoid stock finance imagery and abstract gradients.

## Dark mode

- Not in scope for the initial application.

## Accessibility

- Contrast: palette targets WCAG AA. Focus: visible and unobscured.
- Keyboard: the retry action is a native Material button. Target size: 44px.
- Color independence: all states have explicit text. Reduced motion: supported.
- Async status changes use live regions and preserve a stable layout.
- The authenticated identity is text, truncated visually but available to
  assistive technology. Logout remains a 44px keyboard-operable target and its
  failure message uses `role="alert"`.

## Tokens (source of truth)

```css
:root {
  --font-display: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --font-body: Aptos, 'Trebuchet MS', sans-serif;
  --text-sm: 0.8125rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5625rem;
  --text-2xl: 1.953rem;
  --text-3xl: 3.052rem;
  --spacing: 0.25rem;
  --radius-small: 0.25rem;
  --radius-surface: 0.75rem;
  --color-bg: oklch(0.975 0.012 238);
  --color-surface: oklch(0.995 0.003 240);
  --color-fg: oklch(0.24 0.035 248);
  --color-muted: oklch(0.47 0.035 248);
  --color-border: oklch(0.84 0.035 235);
  --color-accent: oklch(0.48 0.14 245);
  --color-accent-fg: oklch(0.99 0.002 240);
  --color-success: oklch(0.43 0.11 155);
  --color-warning: oklch(0.55 0.13 70);
  --color-error: oklch(0.49 0.18 28);
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
```

- Adapter: Tailwind CSS v4 `@theme` variables in
  `apps/web/src/styles.css`, alongside the prebuilt Angular Material Azure Blue
  theme. The project is Tailwind-first. Product code uses semantic utilities
  such as `bg-surface`, `text-muted`, `border-border`, and `font-display`. Keep
  raw palette values out of component templates. Component stylesheets are not
  created by default.

### Tailwind utility contract

- Use semantic color utilities only: `bg-bg`, `bg-surface`, `text-fg`,
  `text-muted`, `text-accent`, `border-border`, and the named state colors.
  The adapter clears Tailwind's default color and radius namespaces so drift is
  caught during builds instead of becoming a new local convention.
- Use `font-body` for product UI and `font-display` for the wordmark, page
  titles, and high-emphasis financial values. Do not introduce another font in
  a feature.
- Use the shared 4px Tailwind spacing increment, favoring the documented 8px
  rhythm. Keep related content tight and separate regions generously.
- Use `rounded-small` for controls and `rounded-surface` for primary surfaces.
  Do not use arbitrary radii or Tailwind's default color palette.
- Use utilities in templates and Angular `host` metadata. Add component CSS
  only when Tailwind cannot express a third-party integration or complex
  stateful selector clearly. Document that exception in the component.

## Cards and surfaces

- Primary surface: 1px defined border, 12px radius, no shadow, 32px to 48px
  responsive padding. Do not nest cards.

## Slop audit

- Date: 2026-09-27. Result: pass for source, lint, tests, development build, and
  production build.
- Notes: one surface, no gradients or stock imagery, one recovery action per
  failure, explicit async states, visible focus, 44px controls,
  keyboard-operable native actions, reduced-motion handling, and responsive
  reflow are present. Tailwind utilities resolve exclusively through the
  documented semantic tokens; the default Tailwind palette and radius scale do
  not define the product. The authenticated identity and secondary logout
  action extend the persistent top navigation without competing with the
  simulator. A rendered screenshot audit was unavailable because this
  environment has no local browser binary.

## Changelog

- 2026-09-27: made Tailwind CSS v4 the frontend's first-choice styling model,
  projected the Calm Ledger tokens into semantic utilities, migrated the app
  shell, simulator, and authentication fallback, and removed their component
  stylesheets.
- 2026-09-13: extended the application shell with authenticated identity,
  logout states, and safe authentication initialization recovery while keeping
  the Calm Ledger hierarchy and token system.
- 2026-09-12: established the initial browser application design system.
