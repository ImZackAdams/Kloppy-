# Kloppy Implementation Prompts — Recommended Run Order

## Shared instruction to prepend to every prompt

You are working in the Kloppy repo.

Rules:

* Keep the diff small and focused.
* Do not refactor unrelated code.
* Do not push to any remote.
* Make a local git commit at the end with a clear commit message.
* Run `npm test` and `npm run check` before committing.
* Use a cheaper/faster model for `/verify`; do not spend expensive model tokens on verification.
* Conserve tokens: summarize changes briefly, do not dump full files unless necessary, and only explain decisions that matter.
* Preserve existing project conventions: validation/state in the main process, renderer treated as untrusted, no new dependencies unless explicitly necessary, local-first behavior, and userData JSON storage.

---

# 1. Website: wire up the launch checklist

In the Kloppy repo root, `index.html` is the getkloppy.com marketing site with a `STORE` config object that still has placeholder values. Per the README launch checklist, the `$4.20` Stripe Payment Link and a newsletter endpoint need wiring.

Implement this with a small focused diff:

* Refactor so both the payment link and newsletter endpoint live only in the `STORE` config.
* Add graceful degradation:

  * If the payment link is still a placeholder, the buy button should show a Kloppy-voiced “not plugged in yet” state instead of opening a dead link.
  * If the newsletter endpoint is still a placeholder, the form should show a Kloppy-voiced “not plugged in yet” state instead of failing silently.
* Add the newsletter form using plain HTML and minimal JS POST.
* No framework.
* No external JS.
* Add success and failure states in the page’s existing retro Kloppy voice.
* Add a honeypot field for spam.
* Add no tracking or analytics of any kind.
* Keep everything in the single static file so GitHub Pages hosting keeps working.
* Do not invent real Stripe, Formspree, Buttondown, Beehiiv, or other URLs.
* Keep clearly named placeholders.
* Update the README checklist with exactly where to paste the real payment link and newsletter endpoint.

Run checks. Commit locally only.

Suggested commit message:

`Wire launch config for payment and newsletter`

---



# 4. Recurring and snoozable reminders

In `kloppy-desktop`, reminders are currently one-shot:

`{ id, text, dueAt, completed, createdAt }`

Add recurrence and snooze while keeping the storage model a plain JSON array in userData.

Feature 1: recurrence

* Add optional `repeat` field:

  * `'daily'`
  * `'weekly'`
  * `'monthly'`
  * `null`
* Validate `repeat` in the main process.
* Completing a recurring reminder should roll `dueAt` forward to the next occurrence instead of marking it completed.
* Completing a non-recurring reminder should behave as before.
* Rolling a recurring reminder should reset any notification state.
* Define monthly recurrence with clamped month-end behavior:

  * Jan 31 → Feb 28/29
  * Then continue sensibly without producing invalid dates

Feature 2: snooze

* Add `snooze(id, minutes)`.
* Allowed snooze values:

  * `10`
  * `60`
  * `1440`
* Snoozing pushes `dueAt` forward and resets any notified state.
* Invalid snooze values should return the existing `{ ok:false, error }` style.

Renderer updates:

* Add a repeat selector on the reminder add form.
* Add Snooze buttons on the due popup.
* Add Snooze buttons on reminder rows.
* Expose the new calls through `src/preload.js` and `main.js` IPC handlers.
* Follow existing notes/reminders patterns.

Tests:

* Extend `test/notes-reminders.test.js`
* Cover recurrence rollover math
* Cover month-end edge cases
* Cover snooze validation
* Cover notification-state reset on snooze/recurrence

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add recurring and snoozable reminders`

---



# 6. Global summon shortcut

In `kloppy-desktop`, the summon popup is only reachable from the tray menu and an in-app button. Add a global keyboard shortcut.

Requirements:

* Register a default accelerator:

  * Windows/Linux: `Ctrl+Shift+K`
  * macOS: `Cmd+Shift+K`
* Use Electron’s `globalShortcut` when the app is ready.
* Unregister on `will-quit`.
* Make it configurable with a `summonShortcut` setting in `src/settings.js`.
* Empty string should disable the shortcut.
* Validate against a conservative accelerator pattern.
* Accept only combinations of Ctrl/Cmd/Alt/Shift plus a single letter, number, or function key.
* Add a field in the Settings panel in `src/renderer/app.js`.
* Re-register when the setting changes, following the existing `modelPath` change pattern in `main.js`’s `settings:update` handler.
* Handle registration failure gracefully:

  * Return clear `{ ok:false, error }` to the settings UI
  * Have Kloppy grumble about the shortcut being taken
* Pressing the shortcut when the main window is hidden should summon the popup.
* Pressing it again while the popup is visible should show and focus the main window.

Tests:

* Extend `test/settings.test.js` for validation.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add configurable global summon shortcut`

---

# 7. Export backup only

Kloppy stores user data as JSON files in Electron userData:

* `notes.json`
* `reminders.json`
* `settings.json`
* `watched.json`
* `actions.json`

Add export backup support in the Settings panel.

Scope this prompt to export only. Do not implement import yet.

Requirements:

* Add an Export button in the Settings panel.
* Renderer should call a new preload bridge method.
* Main process should handle all file I/O.
* Use `dialog.showSaveDialog`.
* Write a single JSON file shaped like:

```json
{
  "formatVersion": 1,
  "exportedAt": "...",
  "notes": [],
  "reminders": [],
  "settings": {},
  "watchedFolders": [],
  "actions": []
}
```

* Exclude `modelPath` because it is machine-specific.
* Never include, copy, read, or touch model files.
* Do not include llamafile runtime files.
* Do not include logs unless already intentionally part of the app data model.
* Show success/failure in Kloppy’s voice.
* Keep validation/state in main.
* No new dependencies.

Add tests for export shape if there is an existing test pattern that supports it. Otherwise keep the implementation clean and covered where practical.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add Kloppy data export`

---

# 8. Import backup with validation and merge

Now add import support for the Kloppy backup file format.

Requirements:

* Add an Import button in the Settings panel.
* Use `dialog.showOpenDialog` in the main process.
* Treat the import file as untrusted input.
* Validate everything through existing module validators/APIs.
* Do not write files directly from imported JSON.
* Show a confirmation dialog before applying import.
* Confirmation should summarize:

  * number of notes
  * number of reminders
  * number of settings fields
  * number of watched folders
  * number of actions
  * number of skipped invalid entries, if known
* Merge rather than overwrite.
* Skip duplicate ids.
* Preserve imported ids only when they are valid and non-conflicting.
* Skip watched folders that do not exist on this machine and mention that in the result.
* Exclude/import-ignore `modelPath`.
* Never touch model files.
* Return a clear result object to the renderer.
* Report results in Kloppy’s voice.
* Keep all validation/state in main.
* No new dependencies.

Tests:

* Add tests for import validation.
* Add tests for merge behavior.
* Add tests for duplicate ids.
* Add tests for invalid watched folders.
* Add tests showing machine-specific settings like `modelPath` are ignored.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add validated Kloppy data import`

---

# 9. Safe allowlisted action schema

In `kloppy-desktop`, `src/actions.js` stores user-defined actions but deliberately never executes them. There is a TODO at the top of that file about future safe execution safeguards, and `main.js` deliberately has no run channel.

Do not implement execution yet.

First, migrate the action data model safely.

Requirements:

* Define a fixed action schema using `{ type, params }`.
* Keep legacy free-text `command` actions loadable.
* Mark legacy free-text actions as non-runnable.
* Do not execute anything in this prompt.
* Add strict main-process validation for each action type.
* Start with a small allowlist:

  * `openUrl`
  * optionally `openFolder`, only if path validation is already clean
* For `openUrl`:

  * allow only `http` and `https`
  * reject `file:`, `javascript:`, custom protocols, shell strings, and malformed URLs
* For `openFolder`:

  * path must exist
  * path must be a directory
  * path must come from a user picker/dialog or existing trusted state
* No arbitrary command strings.
* No shell spawning.
* No env/secret exposure.
* Update the Actions panel UI to display which actions are runnable and which legacy actions are blocked.
* Update the TODO comment to describe the new invariants.

Tests:

* Add a test file for action validation logic.
* Wire it into the check script if needed.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add safe action schema validation`

---

# 10. Safe allowlisted action execution

Now implement execution for the safe allowlisted actions.

Requirements:

* Execute only fixed action templates.
* Do not spawn shells.
* Do not run arbitrary command strings.
* Use Electron safe APIs:

  * `shell.openExternal` for allowed URLs
  * `shell.openPath` for allowed folders
* Add a main-process IPC run handler only for validated allowlisted actions.
* Per-run confirmation is mandatory:

  * Use `dialog.showMessageBox`
  * Show exactly what will run
  * No “don’t ask again”
* No background execution.
* No env/secret exposure.
* Add visible run logging:

  * Append `{ actionId, name, when, result }` to `actions-log.json` in userData
  * Cap the log size
  * Show recent runs in the Actions panel
* Execution result should use existing `{ ok, error }` style.
* Failed/cancelled runs should be logged clearly.
* Renderer remains untrusted; main process decides what is runnable.

Tests:

* Add tests for log capping and result shape where practical.
* Preserve validation tests from the previous prompt.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Execute safe allowlisted actions`

---

# 11. Watched-folder LLM comments

In `kloppy-desktop`, the folder watcher forwards `{ dir, file, type, at }` events to the renderer. The renderer currently shows canned one-liners from `watcherComments` in `src/renderer/app.js`.

Make Kloppy occasionally generate a bespoke sardonic comment about a file event using the local LLM without compromising local-first rules.

Requirements:

* Only generate comments when the LLM runtime status is already `online`.
* Never spawn the llamafile server just for watcher commentary.
* Respect the idle-shutdown design in `src/llm.js`.
* Heavily rate-limit generated comments:

  * at most one generated comment per few minutes
  * debounce across event bursts
* Fall back to canned lines otherwise.
* Respect existing `randomCommentary` setting.
* Respect existing `commentaryFrequency` levels from `src/settings.js`.
* If `commentaryFrequency` is `'low'`, never use the LLM for watcher commentary.
* Send only the file name and event type to the model.
* Never send full paths.
* Never read or send file contents.
* Keep the watcher contract intact: the watcher never reads file contents.
* Route through a new bounded helper in `src/llm.js`.
* Reuse existing prompt hardening and `MAX_PROMPT_LENGTH`.
* Do not route through renderer `llm:ask`.
* Do not touch chat history.
* Do not touch pendingAction state.
* Generated watcher comments must never be persisted in chat history.

Tests:

* Add a test for the rate limiter.
* Add a test or assertion that low frequency disables LLM watcher comments if practical.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add rate-limited LLM watcher comments`

---

# 12. Packaged release pipeline

The Kloppy repo needs its first distributable desktop builds. `kloppy-desktop` already has `electron-builder` configured in `package.json` with AppImage/deb, dmg/zip, and nsis/zip targets. A manual Linux build exists in `kloppy-desktop/release/`.

Set up release automation.

Requirements:

* Add `.github/workflows/ci.yml`

  * Run on push/PR to main
  * Run `npm ci`
  * Run `npm test`
  * Run `npm run check`
* Add `.github/workflows/release.yml`

  * Trigger on tags matching `v*`
  * Matrix over:

    * ubuntu
    * macos
    * windows
  * Run `npm ci`
  * Run `npm test`
  * Run `npm run check`
  * Run the matching `dist:*` script
  * Upload artifacts to a draft GitHub Release
* Use `working-directory: kloppy-desktop` for desktop commands if that is where the package file lives.
* Do not add signing or notarization secrets yet.
* Leave clearly marked TODO commented-out steps for:

  * macOS notarization
  * Windows signing
* Add a new Releases section to the top-level README.
* Replace the old “No packaged release exists yet” wording.
* Explain unsigned-build implications clearly.
* Verify packaged app does not bundle models:

  * `models/**`
  * `llamafile-runtime/**`
  * `*.download`
* Add `release/` to `.gitignore` if it is not already ignored.
* Check whether built artifacts under `kloppy-desktop/release/` are committed before removing anything from git.
* Do not delete committed artifacts without explicitly showing what would be removed.

Run tests/checks. Commit locally only.

Suggested commit message:

`Add CI and draft release workflows`


3. First-run onboarding

Add a simple first-run flow:

choose Kloppy name/personality
choose model path or skip LLM setup
explain local-first/no telemetry
ask whether reminders and notifications should be enabled
offer to add watched folders
show “summon Kloppy” shortcut

Do not make it fancy. A retro wizard would be perfect.

Why users like it: users do not feel lost the first time they open the app.
