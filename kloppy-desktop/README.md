# Kloppy Desktop

## Overview

Kloppy is a legally distinct desktop gremlin: a retro assistant app in
the spirit of late-90s downloadable desktop software. He takes notes,
yells about reminders, watches folders you point him at, and offers
commentary nobody asked for. Everything is local-first — no cloud
account, no telemetry, no data upload. Kloppy makes exactly one
external network request ever: the optional first-run model download,
only after you press the button for it. After that, he works fully
offline.

Built with Electron and vanilla HTML/CSS/JS. No frameworks, no build
step.

## Current status

As of July 5, 2026, the desktop app is a source-runnable and packageable
local-first MVP. The current `main` branch includes first-run model setup,
checksum-verified local AI download, local chat, notes, reminders, settings,
folder watching, tray behavior, inert action placeholders, and Electron
Builder release scripts. It also has lightweight regression coverage for
the local storage, deterministic chat commands, and setup-state mapping.

The app is designed to be offline after setup. The only external network
request in the app is the optional first-run model download, and that
download is user-approved, pinned, and checksum-verified before use.

Current known gaps:

- Packaged builds are unsigned and not notarized yet
- macOS and Windows artifacts should be produced on their target build hosts
- Actions are stored placeholders only; nothing executes
- Reminder date parsing is intentionally small: relative/today/tomorrow/simple date inputs only
- Model setup recovery diagnostics are still mostly Kloppy-voiced status text

## Features

- **Chat with Kloppy** — real LLM chat powered by a local
  [llamafile](https://github.com/Mozilla-Ocho/llamafile), served on
  localhost only, with live local context and safe note/reminder commands
  (see "Local AI chat" below)
- **Notes** — quick local notes, stored on disk
- **Reminders** — set a time; Kloppy checks every 30 seconds and yells
  via a retro in-app alert plus an OS-level notification (overdue ones
  fire on next launch)
- **Settings** — theme (midnight / beige / toxic green), random
  commentary and its frequency, launch minimized, local model path, and
  optional user name
- **Summon popup** — a small always-on-top mini-Kloppy window with a
  random remark (never stacks; there is only one Kloppy)
- **System tray** — closing the window hides Kloppy to the tray; the
  tray menu can show/hide him, make him say something cursed, summon
  the popup, or actually quit
- **Folder watcher** — opt-in commentary on file added/changed/deleted
  events in folders you pick
- **Actions** — stored placeholders for future allowlisted automation
  (nothing executes; the Run button only refuses)
- **Local identity memory** — optional user name stored in settings so
  chat can answer "what is my name?" without guessing
- **About** — the panel where Kloppy feels perceived

## How to run

```bash
npm install
npm start
```

Regression tests and syntax checks:

```bash
npm test
npm run check
```

Note: if launching from a shell spawned inside VSCode, use
`env -u ELECTRON_RUN_AS_NODE npm start` (VSCode sets that variable and
it breaks Electron).

## Release builds

Packaging uses [Electron Builder](https://www.electron.build/) with a
minimal config in `package.json`. Build output goes to `release/`, which
is ignored by git.

```bash
npm install
npm test
npm run check
npm run build:unpacked
npm run dist:linux
```

Build scripts:

- `npm run build:unpacked` — creates `release/linux-unpacked/` on Linux
  for quick local verification without an installer.
- `npm run dist:linux` — creates Linux distributables, currently AppImage
  and deb packages.
- `npm run dist:mac` — macOS dmg/zip config placeholder; build on macOS,
  then add signing/notarization before public release.
- `npm run dist:win` — Windows nsis/zip config placeholder; build on
  Windows, then add code signing before public release.

Expected artifacts use the pattern `Kloppy-<version>-<os>-<arch>.<ext>`,
for example `Kloppy-0.0.1-linux-x86_64.AppImage` and
`Kloppy-0.0.1-linux-amd64.deb`. Unpacked builds live in
`release/linux-unpacked/`.

Packaged builds do not bundle the downloaded model, partial downloads,
or llamafile runtime cache. Those live under Electron `userData`
(`models/` and `llamafile-runtime/`) after a user explicitly runs setup.
The packaged app still uses the same `app.getPath('userData')` storage,
so an empty model path shows first-run setup exactly like the source-run
app. The single-instance guard remains in `src/main.js` and is preserved
inside the packaged app.

Manual smoke-test checklist before publishing:

- Launch the unpacked app or Linux artifact on a clean profile.
- Confirm only one app instance opens; a second launch focuses the first.
- Confirm Setup appears when `settings.json` has no `modelPath`.
- Confirm no model download starts until the Download button is pressed.
- Cancel a model download and confirm the partial file is removed.
- Save a custom local model path and confirm Chat status changes to ready.
- Add a note and reminder, quit, relaunch, and confirm both persist.
- Let a reminder come due and confirm both in-app and OS notifications.
- Enable Launch minimized, quit, relaunch, and confirm the window starts
  hidden while the tray remains available.
- Close the window and confirm Kloppy hides to the tray instead of quitting.

Release-note privacy disclosure:

Kloppy is local-first. The only external network request made by the app
is the optional first-run download of the pinned recommended llamafile,
started only after explicit user consent and verified by SHA-256 before
use. The downloaded model is not included in app artifacts. Chat talks only
to the local llamafile server on `127.0.0.1`; notes, reminders, settings,
watched folders, actions, model files, and runtime cache stay in Electron
`userData`.

## Local AI chat (llamafile)

Kloppy's chat is powered by [llamafile](https://github.com/Mozilla-Ocho/llamafile):
a single cross-platform executable that bundles a model with an
inference server exposing an OpenAI-compatible API.

On first run, if **Settings -> Local model path** is empty, Kloppy
opens **SETUP.EXE** and offers two choices:

1. **Download recommended model**: downloads one pinned llamafile into
   Electron `userData`, verifies its SHA-256 checksum, saves that path,
   and never re-downloads it on later launches.
2. **I already have a llamafile**: paste your own local path. Kloppy
   respects it and skips the download entirely.

Pinned default:

- Model: `Qwen3.5-0.8B-Q8_0.llamafile`
- Source: `mozilla-ai/llamafile_0.10 @ ce2b08f`
- License: Apache-2.0
- SHA-256:
  `052d8c0d6ef9809b3ba0de6bbdbdc92864a9411b13ef76bb974d7e42e00ab6d1`

How it runs, and why it's private:

- The first-run download is opt-in and explicit. It is the only
  external network request in the app. Bad checksum, network failure,
  or cancel deletes the partial file and lets you retry without
  restarting.
- Chat receives the current local date/time, recent in-memory chat
  turns, your optional local profile name, and retrieved read-only
  summaries of notes, reminders, watched folders, and saved actions.
  Simple requests like "what year is it?", "my name is Zack", "what is
  my name?", "what notes do I have?", "make a note: buy milk", and
  "remind me to stretch in 10 minutes" are handled directly by the app
  before the model is asked.
- The main process spawns the llamafile as a child process in server
  mode, bound to `127.0.0.1` on a free local port. **Nothing leaves
  localhost** — the only address Kloppy ever talks to is his own
  machine.
- The server launches with tuned flags: a bounded 8k context (instead
  of "whatever the model supports", which can eat gigabytes of RAM), a
  single chat slot, prompt-cache reuse between messages, and the
  bundled web UI disabled. GPU offload is automatic when the machine
  has one; if a GPU launch fails, Kloppy retries CPU-only, and if the
  tuned flags are rejected (older user-supplied llamafiles) it falls
  back to a minimal flag set that every release understands.
- The server starts lazily on your first chat message (first reply
  waits for the model to load), shuts down after 20 idle minutes to
  give the RAM back, and is killed when Kloppy quits — no orphan
  processes. A model that keeps crashing on startup trips a
  crash-loop brake instead of being respawned forever; re-saving the
  model path arms it again.
- Each ask health-checks the server first and relaunches it once if it
  died or wedged, so a crashed brain heals on the next message. Server
  output is kept in `userData/llamafile-runtime/server.log`
  (size-capped, rewritten per launch) for diagnosing bad models.
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
  model-setup.js # First-run pinned model download + checksum verification
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

Important userData files/directories:

- `settings.json` — theme, commentary settings, local model path, optional user name
- `notes.json` — local notes
- `reminders.json` — local reminders
- `watched.json` — opt-in watched folder paths
- `actions.json` — inert saved action placeholders
- `models/` — downloaded llamafile, if the user chose first-run setup
- `llamafile-runtime/` — llamafile runtime/cache files confined to userData

## Privacy notes

- Everything stays on your machine. The only external network request
  is the optional first-run model download, disclosed before it starts
  and verified by checksum before use. After that, Kloppy is fully
  offline.
- Chat talks only to `127.0.0.1` — the local llamafile server Kloppy
  himself spawned. Nothing is ever sent off this machine.
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

## Roadmap

### Completed MVP work

- [x] Retro assistant window + CSS/SVG mascot
- [x] Local notes
- [x] Local reminders with in-app alerts
- [x] OS-level notifications for reminders
- [x] System tray with close-to-hide
- [x] Honor "launch minimized" on startup
- [x] Single-instance app guard
- [x] Summon popup window
- [x] Settings with themes, random commentary, local model path, and optional user name
- [x] Opt-in folder watcher
- [x] Actions placeholder (storage only)
- [x] Local LLM chat via llamafile (localhost only)
- [x] Guided first-run AI setup with pinned default model
- [x] Checksum verification before downloaded model use
- [x] Download progress and cancel/cleanup path
- [x] Local chat commands for date/time, identity, notes, and reminders
- [x] Prompt-retrieved local context for notes, reminders, watched folders, and actions
- [x] Automated regression tests for settings, storage, local chat intents, and setup-state mapping
- [x] Electron Builder packaging config for unpacked and Linux release artifacts
- [x] macOS and Windows packaging script/config placeholders

### Next release priorities

- [ ] Build, sign, and notarize downloadable macOS releases on macOS
- [ ] Build and sign downloadable Windows releases on Windows
- [ ] Improve reminder date parsing beyond simple relative/today/tomorrow/date inputs
- [ ] Add model setup recovery diagnostics visible in the UI

### Later / needs design

- [ ] Safe allowlisted action execution (see `src/actions.js` TODO)
- [ ] Import/export or backup flow for local userData
- [ ] Better local retrieval over larger note/reminder sets
- [ ] Optional settings UI for clearing local identity/model/runtime data
