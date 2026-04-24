# Web App UI Kit

Pixel-level recreation of the Dev Thriller web app: chat + files + media + login.

## What's here

| File | Role |
|---|---|
| `index.html` | Interactive entry — renders the full shell with screen switcher + tweak panel. |
| `styles.css` | Shell, sidebar, chat, files, media, login styles. References tokens from `colors_and_type.css`. |
| `Shell.jsx` | Layout shell: `Sidebar`, `Topbar`, icon set. |
| `Chat.jsx` | `ChatView`, `ThreadPanel`, `MediaView`, `FilesView`, `UploadPill`, message components. |
| `Login.jsx` | `LoginScreen` with Google OAuth + email form. |

## Screens covered

1. **Login** — split-screen, tape-stripe marketing half, email + Google.
2. **Chat** — channel view with messages, video/PDF attachments, reactions, composer, thread panel, upload pill.
3. **Files** — tabular file manager with file-type icons, tags, uploader metadata.
4. **Media** — 3-col grid of extracted media with type filters.
5. **Empty states** — Inbox, People placeholders using the "case closed" voice.

## Tweaks

Toggle Tweaks from the toolbar to flip:
- Screen: chat · files · media
- Chat variant: classic · focused (larger body) · transcript (mono body)
- Login variant: ink · tape
- Thread panel on/off
- Upload pill on/off
- Sign out → shows login screen

## Variations for comparison

- **Login — Ink** (default): deep navy right-pane, diagonal ember tape.
- **Login — Tape**: ember right-pane, ink tape. Bolder.
- **Chat — Classic**: default sans body.
- **Chat — Focused**: 15px body, more breathing room.
- **Chat — Transcript**: monospace body for a "case file transcript" feel.
