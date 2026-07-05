# Kloppy Desktop

Kloppy is a retro desktop gremlin assistant, inspired by the golden age of
questionable downloadable desktop software (late 1990s / early 2000s).
He watches. He helps. Mostly he watches.

## Running

```bash
npm install
npm start
```

## Stack

- Electron
- Vanilla HTML / CSS / JavaScript
- No frameworks, no build step

## Structure

```
src/
  main.js       # Electron main process: window, lifecycle, IPC endpoints
  preload.js    # Safe bridge between main and renderer
  notes.js      # Note storage (main process only)
  reminders.js  # Reminder storage (main process only)
  renderer/
    index.html  # The Kloppy window
    styles.css  # Retro styling
    app.js      # UI logic
```

## Local storage

Notes and reminders are saved as JSON inside Electron's per-user app
data directory (`app.getPath('userData')`):

- Linux: `~/.config/kloppy-desktop/`
- macOS: `~/Library/Application Support/kloppy-desktop/`
- Windows: `%APPDATA%/kloppy-desktop/`

`notes.json` holds `{ id, text, createdAt }` entries (newest first).
`reminders.json` holds `{ id, text, dueAt, completed, createdAt }`.
Everything stays on your machine — Kloppy never phones home.

The renderer can't touch the filesystem. It calls `window.kloppy.notes`
and `window.kloppy.reminders` (exposed by the preload script), which go
over IPC to the main process; the main process validates input (no empty
text, length limits, real dates) and does the file I/O.

## Tray behavior

Kloppy lives in the system tray. The 16x16 tray icon is drawn in code
(`src/tray-icon.js`) — no image assets. Closing the window **hides**
Kloppy instead of quitting; he keeps running (and keeps watching the
clock for reminders) in the background.

Tray menu:

- **Show Kloppy** / **Hide Kloppy** — toggle the window
- **Say something cursed** — Kloppy shares an unsettling thought in the
  main window (visible next time you show it, if it's hidden)
- **Quit** — actually exits. The only way out.

## Settings

The Settings panel is stored in `settings.json` (same userData folder)
and applies instantly:

- **Launch minimized** — stored now, honored in a future version
- **Random commentary** — whether Kloppy occasionally pipes up on his own
- **Commentary frequency** — low / medium / cursed (cursed is more
  frequent and draws from the cursed remark pool)
- **Theme** — midnight (default), beige, or toxic green

## Summon popup

"Summon Kloppy" (main window button or tray menu) opens a small
always-on-top popup in the bottom-right corner where a mini Kloppy
delivers a random remark. Summoning again reuses the same popup —
Kloppys do not stack. "Go away, Kloppy" closes it. He does not
take it personally.

## Reminders

While the app is open, the renderer checks every 30 seconds for due
reminders. When one comes due, Kloppy shows a retro in-app alert popup,
marks the reminder completed, and files it under "already yelled about".
Reminders that came due while the app was closed fire on next launch.

## Folder watcher & privacy

The Folder Watcher panel lets you pick folders (via the OS folder
dialog) for Kloppy to comment on. Privacy rules, enforced in code:

- **Opt-in only** — Kloppy watches nothing until you choose a folder.
- **Top level only** — watching is not recursive, and never the whole
  filesystem.
- **Names only** — Kloppy sees file names and event types
  (added / changed / deleted). File contents are never read.
- **Local only** — nothing is uploaded, ever. The recent-events list
  lives in memory and vanishes when the app closes.
- Watched folder paths persist in `watched.json` in userData; use
  "Unwatch" to remove one. All watchers are released on quit.

## Security defaults

- `contextIsolation: true`
- `nodeIntegration: false`
- Preload script exposes only an explicit, minimal API
