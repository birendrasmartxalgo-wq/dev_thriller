# Dev Thriller — Design System

> *"The suspense of a thriller, the precision of a dev tool."*

Dev Thriller is a team collaboration platform (chat + files + projects) dressed as a **case file**. Every project is a dossier, every channel is an interrogation room, every shipped feature closes a chapter. The surface is warm, colorful and playful — the details (monospace metadata, hash-chained audit logs, case numbers) are technical and precise.

This design system is the source of truth for Dev Thriller's visual and content language. It ships:

- **Brand identity** — logo marks, color system, typography, iconography
- **Foundations** — spacing, radii, shadow, motion tokens (`colors_and_type.css`)
- **UI kits** — pixel-level recreations for the **Web app** and **Mobile app**
- **Content guidelines** — copy tone, casing, voice, examples
- **Product spec** — full PRD + system design (`PRD.md`) as design anchor

---

## Sources

This is a **new brand built from scratch** — no existing codebase or Figma to lift from. Reference points the user cited:

- **Asana** (https://asana.com) — workspace architecture reference for the underlying PRD
- **Aesthetic anchors:** Slack (playful + colorful chat), Airtable (warm, approachable dev tool)
- **Product name:** "Dev Thriller" — chosen by the user
- **Tone:** Technical & precise
- **Icons:** Outlined (Lucide)

Not derived from any external design system. All marks, color choices, type pairings and components are originals for this project.

---

## Content Fundamentals

Dev Thriller's copy has **two registers** that braid together:

1. **Dev-tool precision** — clear, imperative, specific. Numbers and units, not adjectives.
2. **Case-file drama** — occasional noir-flavored metaphor (*case*, *lead*, *dossier*, *chapter*), mostly in metadata and empty-states, never in functional copy.

### Voice rules

- **Second person, present tense.** *"You're in workspace Acme"* — not "The user is in…".
- **Imperative for actions.** *Open file* · *Invite teammates* · *Revoke link*. Never *Click here to open file*.
- **No exclamation marks.** Intensity comes from specificity, not punctuation.
- **Sentence case** for buttons, labels, headings. Exception: `MONO LABELS IN CAPS` for meta (timestamps, case numbers, status tags).
- **No emoji in UI chrome.** Reactions are user-generated; don't seed emoji into our own copy.
- **Technical units are honored.** *1.2 GB · 42 messages · 3 files* — never *a lot of* / *many*.
- **I / we are avoided.** The product doesn't talk about itself. Prefer passive for system-originated status: *"Share link revoked."*

### Casing examples

| Where | Style | Example |
|---|---|---|
| Page title | Sentence case | "Files in Marketing" |
| Button | Sentence case | "Share file" |
| Meta label (mono caps) | UPPERCASE + tracking | `CASE · 0142` · `MEMBER · ADMIN` |
| Status pill | Sentence case | "Uploading" · "Resolved" |
| Empty state | Sentence case + noir flavor | *"No leads yet."* · *"Nothing in evidence."* |

### Empty states (one per pattern)

- Chat with no messages: **"Quiet in here. Drop the first line."**
- Files folder empty: **"Evidence locker is empty. Drag a file in."**
- Search no results: **"Nothing matches `{query}`. Try fewer clues."**
- Notifications cleared: **"You're caught up. Case closed for now."**

### Microcopy — do / don't

| Don't | Do |
|---|---|
| "Oops! Something went wrong 😬" | "Upload failed. Retry." |
| "Successfully shared your file!" | "Link copied." |
| "You have 42 unread messages" | "42 unread" |
| "Are you sure you want to delete?" | "Delete `draft.pdf`? You can restore within 30 days." |

### Vibe

Confident, a little dry, occasionally winking. The brand knows it's called "Dev Thriller." It leans in once or twice per screen — in an empty state, a loading line, a 404 — but never interrupts the work. Think **Linear** for crispness, **Stripe Docs** for clarity, **Arc** for the occasional unexpected detail.

---

## Visual Foundations

### Colors

Five hues + warm neutrals. Semantic tokens reference the scales; never use raw scales in components.

| Role | Hue | Use |
|---|---|---|
| **Ember** `#FF512E` | red-orange | Primary brand, CTAs, focus, evidence tape |
| **Ink** `#1E2247` | deep navy | Inverse surface, headers, dark UI |
| **Tape** `#FFCB3D` | buttery yellow | Highlight, warnings, the tape motif |
| **Mint** `#2EBD82` | cool green | Success, "case closed" |
| **Lavender** `#8B6BF0` | soft violet | Info, decorative pops, tags |
| **Blood** `#D61F3E` | deep crimson | Destructive only |
| **Paper** `#FAF6EC` | warm off-white | Default surface (never `#FFFFFF`) |
| **Charcoal** `#1B1808` | warm near-black | Primary text (never `#000`) |

**Rule:** surfaces are warm (`paper-*`). Pure white and pure black are banned. Grey is banned — neutrals come from the warm paper/charcoal ramps.

### Type

Three families pull three jobs:

- **Instrument Serif** (display) — hero moments, big numbers, decorative italics. Thriller-novel feel.
- **Geist** (UI sans) — everything else. Wide weight range (300–800), crisp, modern.
- **JetBrains Mono** (mono) — labels, case numbers, timestamps, code, metadata.

> **Font substitution flag:** No custom fonts were licensed. These three are pulled from **Google Fonts** as the nearest match for the intended vibe. If the user has licensed alternates (e.g. a display like *GT Sectra*, a UI sans like *Söhne*, a mono like *Berkeley Mono*), swap via `--font-display / --font-sans / --font-mono` in `colors_and_type.css`.

### Backgrounds

- **Surfaces are solid warm paper**, not gradients. A full-bleed `--ember-500` is allowed for one CTA per screen.
- **No photographic backgrounds** in chrome. Marketing surfaces may use cropped editorial imagery with a warm grade (slight sepia / muted saturation).
- **Texture** allowed sparingly: a `0.03`-opacity noise on large ink panels to echo paper grain. Optional.
- **No repeating patterns** in UI chrome.

### Animation

- **Curves:** `--ease-out` for most UI, `--ease-spring` (slight overshoot) for reveals.
- **Durations:** 140ms (hover/press), 220ms (default), 360ms (panel/modal).
- **Fades > slides.** Prefer opacity + 4-8 px translate. No slide-from-right drawers.
- **No bounce** in destructive confirmations.
- **Cursor follow, parallax, sparkle on hover: banned.**

### Hover / press states

- **Hover** — one of: +4% luminance on brand surfaces; `paper-100` fill on transparent items; underline thickening on links. Never a shadow change alone.
- **Press** — scale to `0.98` + slightly darker fill. 80ms duration.
- **Focus** — `--sh-focus` ring in ember, 3px, offset via box-shadow. Never outline.

### Borders

- **Default border is 1px `--border-soft` (`#E3D9C0`)** — warm, not grey.
- **Strong border** `1px --border` for dividers that need presence.
- **Accent border** `2px --ember-500` for selected/active state only.
- Dashed borders reserved for **drop zones** and **empty placeholders**.

### Shadow / elevation

Shadows are **warm**, using `rgba(53, 48, 31, 0.x)` — never `rgba(0,0,0,…)`. Five levels (`--sh-0 → --sh-4`). Layered: a short tight shadow + a longer diffuse one. Modal = `--sh-4`, popover = `--sh-3`, card resting = `--sh-1`.

Inset highlight (`--sh-inset`) gives surfaces a paper-like top edge. Use on elevated cards.

### Protection gradients

For text over imagery use a **bottom-up gradient from `rgba(14,17,48,0.75) → 0%`**, never a dark vignette. Capsules over imagery use a `paper-0` fill with `--sh-2`.

### Transparency & blur

- Backdrop blur (`backdrop-filter: blur(14px)`) only for **sticky toolbars above scrolling content** and **mobile status-bar overlays**.
- Transparent surfaces elsewhere must have ≥80% opacity on warm paper.
- Never stack two blurs.

### Corner radii

- `--r-xs` 3px — chips, code pills
- `--r-sm` 6px — inputs, small buttons
- `--r-md` 10px — default buttons, menu items
- `--r-lg` 14px — cards, panels
- `--r-xl` 20px — modals, sheets, hero tiles
- `--r-pill` 999px — avatars, status dots, tags

**Radii are consistent, not squishy.** No 24px+ super-rounded bubbles.

### Cards

A Dev Thriller card is:

- `--bg-raised` (`paper-0`) fill
- `1px solid --border-soft` 
- `--r-lg` 14px radius
- `--sh-1` resting, `--sh-2` hover
- Optional `--sh-inset` for top highlight
- No drop shadow + no border at the same level — pick one primary delineation

### Layout rules

- **Sidebar 260px fixed**, header 56px fixed — both in the web app.
- **12-column grid** at `1280px` container max, **gutters 24px**.
- **Content density:** comfortable — prefer 16px vertical rhythm over 8px.
- **One CTA per surface.** Everything else is secondary or tertiary.

### Imagery grade

When photographic content appears (rare), grade it **warm** — slight yellow-orange tint, +5 saturation, −3 highlights. Avoid cool/blue and pure B&W. Subjects feel lit by late-afternoon sun or a desk lamp, not a studio.

### Signature motifs

1. **Yellow tape highlight** behind key words — `.tape-highlight` utility. Appears in hero moments and empty states.
2. **Monospace case numbers** — every workspace, project, file has a short `CASE · 0142` label in mono caps. Decorative but consistent.
3. **Folder-tab silhouette** — the logo shape recurs in illustrations (section dividers, empty-state graphics).
4. **`· ` separators** — middle-dot `·` between mono meta items instead of `/` or `|`.

---

## Iconography

**Icon system:** [Lucide](https://lucide.dev) — outlined, 1.5px stroke, 24px default. Linked from CDN at `https://unpkg.com/lucide-static@latest/icons/<name>.svg`.

### Why Lucide

- Outlined style matches the user's preference.
- Large coverage (1,400+ icons) — unlikely to need substitution.
- Neutral geometry — plays well with the warm paper surface.
- Consistent 1.5px stroke weight at 24×24 viewBox.

### Usage rules

- **Stroke** matches current text color (`stroke="currentColor"`). Never use filled Lucide variants.
- **Default size 20px** inline with body text, **24px** for nav/toolbars, **32px** for feature callouts, **16px** for dense meta rows.
- **`stroke-width: 1.75`** — a touch heavier than Lucide's 2px default, for Dev Thriller's slightly crisper feel. Set via CSS on `svg.icon`.
- **Color:** `--fg2` resting, `--fg1` on hover, `--ember-500` when active/selected.
- **No icon-only buttons** without aria-label. Tooltips on desktop.

### When emoji / unicode

- **Emoji:** user-generated only (chat reactions, message content). Never in UI chrome, buttons, empty states, or marketing copy.
- **Unicode as glyph:** allowed for a handful of typographic characters — `·` (middle dot, separator), `↗` (external link), `→` (arrow in CTAs), `—` (em dash). Use these freely.

### Custom marks

Three one-off SVGs live in `assets/` and are considered part of iconography:

- `logo-monogram.svg` — folder-tab "DT" mark
- `logo-wordmark.svg` / `logo-wordmark-dark.svg` — full wordmark with case number
- `case-tab.svg` — unbranded folder-tab silhouette for illustrations *(not yet created — flag)*

No other custom icons should be hand-drawn. If a concept isn't in Lucide, either compose from Lucide icons or file a request.

---

## Index

Root of this design system:

```
README.md                  ← you are here
PRD.md                     ← product spec for the app being designed
SKILL.md                   ← Agent Skill entry point (cross-compatible)
colors_and_type.css        ← tokens + semantic classes
assets/                    ← logos + static visual assets
  logo-monogram.svg
  logo-wordmark.svg
  logo-wordmark-dark.svg
preview/                   ← design-system preview cards (one per concept)
ui_kits/
  web_app/
    index.html             ← interactive recreation
    README.md
    *.jsx                  ← components
  mobile_app/
    index.html
    README.md
    *.jsx
```

### UI kits

| Kit | Surface | Entry |
|---|---|---|
| Web app | Main workspace (chat + files + projects) | `ui_kits/web_app/index.html` |
| Mobile app | iOS-flavored phone version of the same | `ui_kits/mobile_app/index.html` |

### Caveats / open items

- **Fonts** are Google Fonts substitutions — flagged above. Swap when licensed fonts land.
- **No `case-tab.svg`** yet — I can add the unbranded illustration tab if needed.
- **Dark mode** is defined via tokens but no explicit dark surface set yet; the `logo-wordmark-dark` is the only dark-surface asset.
- **Marketing site** was out of scope per the product-surfaces answer — easy to add.
