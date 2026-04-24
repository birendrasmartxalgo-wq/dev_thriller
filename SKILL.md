# SKILL — Using the Dev Thriller design system

When a user asks you to design something that fits in the **Dev Thriller** brand universe (a playful, cinematic-thriller-inflected team chat for developers + creative ops teams), use the materials in this project as your source of truth.

---

## 1. Start here, every time

Read these three files **before** writing any HTML:

- `README.md` — Brand principles, content fundamentals, visual foundations, index of every asset.
- `PRD.md` — Product description. Explains what the app is, who uses it, and the vocabulary (cases, cuts, chunks, locks).
- `colors_and_type.css` — All design tokens as CSS variables: colors, type, spacing, radii, shadows, motion. Link this stylesheet from every HTML deliverable.

The **preview/** folder has one HTML card per primitive (`preview/colors-primary.html`, `preview/type-display.html`, `preview/buttons.html`, etc.). Open the relevant card when you need a visual reference for how a token or component should look.

---

## 2. Core rules

### Link the tokens
Every HTML file MUST include the stylesheet and use CSS variables — never hard-code a color, font, or spacing value.

```html
<link rel="stylesheet" href="colors_and_type.css"/>
```

Use tokens:
- Color: `var(--ember-500)`, `var(--ink-900)`, `var(--paper-0)`, `var(--blood-700)`, `var(--mint-500)`, `var(--tape-200)`, `var(--lav-500)`, `var(--fg1)`, `var(--fg2)`, `var(--fg3)`, `var(--border)`, `var(--border-soft)`.
- Type: families `var(--font-sans)` (Inter), `var(--font-display)` (Source Serif 4), `var(--font-mono)` (JetBrains Mono). Sizes `--ts-xs` → `--ts-5xl`. Helper classes `.t-hero`, `.t-display`, `.t-h1..4`, `.t-body`, `.t-label`, `.t-caseno`, `.t-meta`, `.t-code`.
- Spacing/radius/shadow: `var(--sp-4)`, `var(--r-md)`, `var(--sh-1)`, etc.

### Voice
- Write tight. Technical but warm. Use the domain vocabulary from PRD: **cases, cuts, chunks, checksums, locks, resumable, sha256**.
- Metadata is stamped in uppercase mono with `· ` separators: `CASE · 0142 · MARKETING · Q3`.
- Case numbers are 4-digit, zero-padded.
- Serif display (Source Serif 4) is for hero moments only — not for UI chrome.

### Visuals
- Paper-cream background (`--paper-0` through `--paper-300`) is the default surface. Don't put everything on pure white.
- Ember-orange (`--ember-500`) is the primary accent — CTAs, unread badges, my-side chat bubbles, active-nav state. Don't dilute it across decorative elements.
- Tape yellow (`--tape-200`) is ONLY used as a handwritten highlight behind important words via `.tape-highlight`.
- Blood red (`--blood-500/700`) signals danger/delete only.
- Avoid gradients except in placeholder media thumbnails (see mobile media grid + chat screen).
- Never invent new colors — pick from the palette. For harmonious shades between tokens, use `oklch()`.

### Logo
- Three variants in `assets/`: `logo-wordmark.svg` (light bg), `logo-wordmark-dark.svg` (dark bg), `logo-monogram.svg` (the "DT" square for avatars, favicons, tight spots).
- Don't redraw the logo — reference the SVG files.

### Icons
- The web-app UI kit ships a lucide-style icon set in `ui_kits/web_app/Shell.jsx` as `UIKit.I.*` (hash, lock, folder, file, search, bell, plus, chevron, image, film, paperclip, atSign, smile, send, mic, users, check, x, moreH, pin, link). Reuse these when building new web surfaces.
- Same handle works in mobile screens — the mobile layer imports Shell.jsx and pulls `I.*` from the shared `UIKit` global.

---

## 3. Component kits — reference and reuse

### Web app — `ui_kits/web_app/index.html`
A full desktop workspace showing: **login, chat, thread panel, media, files, upload pill.** Interactive and tweakable (density, dark mode, copy variants). Components live in:
- `Shell.jsx` — Icons, Sidebar, Topbar
- `Chat.jsx` — ChatView, ThreadPanel, MediaView, FilesView, UploadPill
- `Login.jsx` — LoginScreen
- `styles.css` — web-app-specific classes (buttons, rows, inputs)

### Mobile app — `ui_kits/mobile_app/index.html`
iPhone screens on iOS 26 frames: **login, chat list, chat thread, media grid, upload in progress.** Components in `Screens.jsx`.

### When building new surfaces
- Reuse components from the UI kits directly — import `Shell.jsx`, `Chat.jsx`, etc. via `<script type="text/babel" src="…">` tags.
- Each .jsx file is already wrapped in an IIFE to avoid top-level `const` collisions. If you add a new .jsx, wrap it the same way.
- Match the existing patterns: left sidebar with workspace switcher on web; bottom tab bar on mobile; case-number + breadcrumb in the header; ember-accented unread states.

---

## 4. Domain vocabulary (use this, not generic chat-app terms)

| Domain term | Generic term | Use |
|---|---|---|
| **Case** | Project / workspace | `CASE · 0142` |
| **Chat** | Channel | `# q3-campaign` |
| **Cut** | File version | "latest cut" |
| **Chunk** | Upload segment | `Chunk 64 / 105` |
| **Lock** | Finalize | "Locked version pushed" |
| **sha256** | Checksum | "sha256 verified" |

Sprinkle these naturally — they are the product's voice.

---

## 5. Quick checklist before delivering

- [ ] Linked `colors_and_type.css`
- [ ] Used CSS variables, no hard-coded colors/fonts
- [ ] Used existing icons from `UIKit.I`
- [ ] Voice matches (case numbers, mono metadata, technical copy)
- [ ] Logo referenced from `assets/` (not redrawn)
- [ ] Ember used for intentional accents only — not everything is orange
- [ ] New .jsx files wrapped in IIFE
