# Kloppy Desktop

## Overview

Kloppy is a legally distinct desktop gremlin: a retro assistant app in
the spirit of late-90s downloadable desktop software. He takes notes,
yells about reminders, watches folders you point him at, and offers
commentary nobody asked for. Everything is local-first — no cloud
account, no telemetry, no data upload.

Built with Electron and vanilla HTML/CSS/JS. No frameworks, no build
step.

## Features

- **Notes** — quick local notes, stored on disk
- **Reminders** — set a time; Kloppy checks every 30 seconds and yells
  via a retro in-app alert (overdue ones fire on next launch)
- **Settings** — theme (midnight / beige / toxic green), random
  commentary and its frequency, applied instantly
- **Summon popup** — a small always-on-top mini-Kloppy window with a
  random remark (never stacks; there is only one Kloppy)
- **System tray** — closing the window hides Kloppy to the tray; the
  tray menu can show/hide him, make him say something cursed, summon
  the popup, or actually quit
- **Folder watcher** — opt-in commentary on file added/changed/deleted
  events in folders you pick
- **Actions** — stored placeholders for future allowlisted automation
  (nothing executes; the Run button only refuses)
- **About** — the panel where Kloppy feels perceived

## How to run

```bash
npm install
npm start
```

Note: if launching from a shell spawned inside VSCode, use
`env -u ELECTRON_RUN_AS_NODE npm start` (VSCode sets that variable and
it breaks Electron).

## Project structure

```
src/
  main.js       # Electron main process: windows, tray, lifecycle, IPC
  preload.js    # Safe bridge: the only API the renderer can touch
  notes.js      # Note storage (main process only)
  reminders.js  # Reminder storage (main process only)
  settings.js   # Settings storage + validation (main process only)
  watcher.js    # Opt-in folder watching (main process only)
  actions.js    # Action storage — no execution (main process only)
  renderer/
    index.html  # The main Kloppy window
    popup.html  # The summon popup window
    styles.css  # Retro styling + themes
    app.js      # Main window UI logic
    popup.js    # Popup UI logic
```

All user data lives as JSON files in Electron's per-user data directory
(`app.getPath('userData')`):

- Linux: `~/.config/kloppy-desktop/`
- macOS: `~/Library/Application Support/kloppy-desktop/`
- Windows: `%APPDATA%/kloppy-desktop/`

## Privacy notes

- Everything stays on your machine. There is no network code at all.
- The folder watcher is **opt-in** (OS folder picker only), watches
  only the top level of chosen folders, and sees only file names and
  event types — never file contents. Recent events live in memory and
  vanish on close.
- Actions are inert text. There is intentionally no IPC channel that
  executes anything; see the safety TODO in `src/actions.js`
  (allowlists, confirmation prompts, run logs, no secret exposure, no
  silent background execution) required before a real run button can
  exist.
- Renderer processes have no Node access (`contextIsolation` on,
  `nodeIntegration` off); they can only call the explicit preload API.

## MVP roadmap

- [x] Retro assistant window + CSS/SVG mascot
- [x] Local notes
- [x] Local reminders with in-app alerts
- [x] System tray with close-to-hide
- [x] Summon popup window
- [x] Settings with themes + random commentary
- [x] Opt-in folder watcher
- [x] Actions placeholder (storage only)
- [ ] Honor "launch minimized"
- [ ] OS-level notifications for reminders
- [ ] Safe allowlisted action execution (see `src/actions.js` TODO)
- [ ] Packaging/installers
