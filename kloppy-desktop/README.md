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

## Reminders

While the app is open, the renderer checks every 30 seconds for due
reminders. When one comes due, Kloppy shows a retro in-app alert popup,
marks the reminder completed, and files it under "already yelled about".
Reminders that came due while the app was closed fire on next launch.

## Security defaults

- `contextIsolation: true`
- `nodeIntegration: false`
- Preload script exposes only an explicit, minimal API
