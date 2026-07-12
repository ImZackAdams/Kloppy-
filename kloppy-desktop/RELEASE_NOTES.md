# Kloppy Release Notes

## v0.1.0

Kloppy has crawled out of the folder he was watching and into his first public
build. He takes notes, yells about reminders, judges your files, and now runs a
real local AI brain — all without ever phoning home. He means well. Probably.

### Features

- **Chat with Kloppy** — real LLM chat powered by a local llamafile, served on
  `127.0.0.1` only, with live local context and safe note/reminder commands.
- **Notes** — quick local notes, stored on disk.
- **Reminders** — set a time; Kloppy checks every 30 seconds and yells via a
  retro in-app alert plus an OS-level notification (overdue ones fire on next
  launch).
- **Settings** — theme (`light` / `dark`), personality mode (Helpful, Goblin,
  Corporate, Quiet, or Chaos Kloppy), random commentary and its frequency,
  launch minimized, local model path, and optional user name.
- **Summon popup** — a small always-on-top mini-Kloppy window with a random
  remark (there is only one Kloppy).
- **System tray** — closing the window hides Kloppy to the tray instead of
  quitting.
- **Folder watcher** — opt-in commentary on file added/changed/deleted events
  in folders you pick (top level only, names and event types only).
- **Local identity memory** — optional user name stored in settings.
- **Guided first-run AI setup** — one pinned, opt-in, SHA-256-verified model
  download.

### Privacy

Kloppy is local-first. The only external network request made by the app
is the optional first-run download of the pinned recommended llamafile,
started only after explicit user consent and verified by SHA-256 before
use. The downloaded model is not included in app artifacts. Chat talks only
to the local llamafile server on `127.0.0.1`; notes, reminders, settings,
watched folders, actions, model files, and runtime cache stay in Electron
`userData`.

### Known limitations

- Builds are **unsigned** on all three OSes, so macOS Gatekeeper and Windows
  SmartScreen will warn on first launch — see "Installing unsigned builds" in
  the README for how to open them.
- Reminder parsing is intentionally simple: relative / today / tomorrow /
  basic date inputs only.
- **Actions** are stored placeholders — nothing executes; the Run button only
  refuses.
- There is **no auto-update**; new versions are downloaded and installed
  manually.
