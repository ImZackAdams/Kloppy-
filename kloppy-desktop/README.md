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

- **Chat with Kloppy** — real LLM chat powered by a local
  [llamafile](https://github.com/Mozilla-Ocho/llamafile), served on
  localhost only (see "Local AI chat" below)
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

## Local AI chat (llamafile)

Kloppy's chat is powered by [llamafile](https://github.com/Mozilla-Ocho/llamafile):
a single cross-platform executable that bundles a model with an
inference server exposing an OpenAI-compatible API. Kloppy does not
ship model weights — you point him at a llamafile you already have:

1. Get any llamafile (e.g. from the llamafile release page or
   Hugging Face) and make it executable (`chmod +x model.llamafile`).
2. In Kloppy: **Settings → Local model path** → paste the full path.
3. Open **Chat with Kloppy** and say something.

How it runs, and why it's private:

- The main process spawns the llamafile as a child process in server
  mode, bound to `127.0.0.1` on a free local port. **Nothing leaves
  localhost** — the only address Kloppy ever talks to is his own
  machine.
- The server starts lazily on your first chat message (first reply
  waits for the model to load) and is killed when Kloppy quits — no
  orphan processes.
- No chat history is saved anywhere; the transcript lives in memory
  and vanishes on close.
- If no path is configured, or the model fails to start, chat shows a
  Kloppy-voiced explanation instead of an error box — the app never
  crashes over it.

## Project structure

```
src/
  main.js       # Electron main process: windows, tray, lifecycle, IPC
  preload.js    # Safe bridge: the only API the renderer can touch
  llm.js        # Local llamafile server management + chat (main process only)
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

- Everything stays on your machine. The only network code in the app
  talks to `127.0.0.1` — the local llamafile server Kloppy himself
  spawned. Nothing is ever sent off this machine.
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
- [x] Local LLM chat via llamafile (localhost only)
- [ ] Honor "launch minimized"
- [ ] OS-level notifications for reminders
- [ ] Safe allowlisted action execution (see `src/actions.js` TODO)
- [ ] Packaging/installers
