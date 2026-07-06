# Kloppy Release Prompts — Run In Order

Goal: take the repo from "source-runnable MVP" to a v0.1.0 public release with
downloadable desktop builds for Linux, macOS, and Windows, distributed from the
`index.html` marketing site at the repo root (getkloppy.com via GitHub Pages).

State of the repo when these prompts were written (2026-07-06):

- The Electron app in `kloppy-desktop/` is healthy: 51/51 tests pass,
  `contextIsolation` on, all validation in the main process, local-first,
  electron-builder targets configured for AppImage/deb, dmg/zip, and nsis/zip.
- Work sits on the `ui` branch, one commit ahead of `main`, with uncommitted
  renderer changes (personality modes UI) in the working tree.
- There is no application icon configured for electron-builder (only the 32×32
  programmatic tray icon in `src/tray-icon.js`), no LICENSE file despite
  `"license": "MIT"`, no `.github/` CI, and the packaged app ships Electron's
  default menu bar (with Reload and Toggle DevTools).
- The marketing site `index.html` has a $4.20 Stripe test payment link and a
  newsletter form, but **no download section** — that is the distribution
  channel to build.
- GitHub remote: `https://github.com/ImZackAdams/Kloppy-.git` — note the
  trailing hyphen in the repo name; do not "fix" it in URLs.

Consciously deferred (not release blockers for v0.1.0): code signing and
notarization, richer reminder date parsing, model-setup recovery diagnostics
UI, action execution, import/export.

## Shared instruction to prepend to every prompt

You are working in the Kloppy repo.

Rules:

* Keep the diff small and focused.
* Do not refactor unrelated code.
* Do not push to any remote unless the prompt explicitly says to.
* Make a local git commit at the end with a clear commit message.
* Run `npm test` and `npm run check` in `kloppy-desktop/` before committing
  any change that touches the app.
* Use a cheaper/faster model for `/verify`; do not spend expensive model
  tokens on verification.
* Conserve tokens: summarize changes briefly, do not dump full files unless
  necessary, and only explain decisions that matter.
* Preserve existing project conventions: validation/state in the main
  process, renderer treated as untrusted, no new dependencies unless
  explicitly necessary, local-first behavior, userData JSON storage, and the
  single static `index.html` for the site (no external JS, no tracking).

---

# 1. Consolidate the working tree and branches onto main

The repo is on the `ui` branch, which is one commit ahead of `main`
("Add Kloppy personality modes"). The working tree has uncommitted changes to
`PROMPTS.md`, `kloppy-desktop/src/renderer/app.js`,
`kloppy-desktop/src/renderer/index.html`, and
`kloppy-desktop/src/renderer/styles.css` — in-progress personality-modes UI
work plus pruning of completed prompts from `PROMPTS.md`.

Tasks:

* Review the uncommitted renderer changes. If they are a coherent, working
  continuation of the personality-modes feature, finish any obvious loose
  ends and commit them on `ui`. If they are broken or half-done, split out
  what works and stash or revert the rest — show what would be dropped before
  dropping anything.
* Commit the `PROMPTS.md` cleanup separately.
* Run `npm test` and `npm run check`; manually launch the app once
  (`env -u ELECTRON_RUN_AS_NODE npm start` from `kloppy-desktop/`) and verify
  the personality mode selector works and persists across a restart.
* Merge `ui` into `main` locally (fast-forward or merge commit, whichever is
  cleaner). Do not delete branches. Do not push.
* End state: clean working tree, `main` contains everything, later prompts
  run from `main`.

Suggested commit messages:

`Finish personality modes UI` and `Prune completed prompts`

---

# 2. Release polish: application menu, DevTools, and About version

The packaged app currently ships Electron's default menu bar, which exposes
Reload and Toggle DevTools — fine in dev, sloppy in a release.

Requirements:

* In `src/main.js`, set an application menu appropriate for release:
  * On Windows/Linux: remove the menu bar entirely
    (`Menu.setApplicationMenu(null)` or equivalent).
  * On macOS: keep a minimal menu with the standard app menu and an Edit menu
    built from roles (undo/redo/cut/copy/paste/select all) so clipboard
    shortcuts keep working. No View menu in packaged builds.
  * When `!app.isPackaged`, keep DevTools reachable (default menu or a dev
    accelerator) so development is not hurt.
* Expose the app version to the renderer through the existing preload bridge
  pattern (a single read-only `app:version` style IPC handler in main,
  surfaced via `src/preload.js`). Use `app.getVersion()`.
* Show the version in the existing About panel in `src/renderer/app.js`, in
  Kloppy's voice (e.g. "kloppy.exe v0.1.0 — still here").
* Verify text input fields still support copy/paste on all paths you can
  test locally.

Tests:

* Extend an existing test file only if a pattern fits; otherwise manual
  verification is acceptable for menu behavior. Note what you verified.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Ship release menu and About version`

---

# 3. Application icon assets for all three platforms

electron-builder has no `icon` configured, so packaged builds fall back to
the default Electron icon. The only mascot art in code is the 32×32
pixel-art grid in `src/tray-icon.js` (`ART` + `PALETTE`).

Requirements:

* Add a small script (e.g. `kloppy-desktop/scripts/generate-icon.js`) that
  renders the existing `ART`/`PALETTE` pixel grid to a 1024×1024 PNG using
  crisp nearest-neighbor expansion (each source pixel becomes a 32×32 block).
  No new npm dependencies — run it under the already-installed Electron
  binary if you need `nativeImage`, or emit the PNG bytes directly.
* Refactor so the ART grid and palette are importable by both
  `tray-icon.js` and the script without duplicating the art. Tray behavior
  must not change.
* Write the output to `kloppy-desktop/build/icon.png` and commit the
  generated file. electron-builder picks up `build/icon.png` as the source
  icon and derives `.icns`/`.ico` for macOS/Windows at build time — verify
  this actually happens rather than assuming it; if a platform needs an
  explicit `mac.icon`/`win.icon` entry, add it.
* Make sure `build/` is not caught by any ignore rule and is included in the
  repo but NOT packaged inside the app (`files` already excludes what it
  should; confirm).
* Add an npm script `icon:generate` so the icon can be regenerated.
* Rebuild the unpacked Linux app (`npm run build:unpacked`) and confirm the
  window/dock icon is the mascot, not the Electron default.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add generated app icon for packaged builds`

---

# 4. LICENSE, version bump, and release notes

`kloppy-desktop/package.json` declares MIT but no LICENSE file exists
anywhere in the repo. The app version is 0.0.1.

Requirements:

* Add a standard MIT `LICENSE` file at the repo root, copyright the current
  year and the project owner (use the git author identity; do not invent a
  legal entity).
* Bump `kloppy-desktop/package.json` version to `0.1.0`.
* Create `kloppy-desktop/RELEASE_NOTES.md` with a `v0.1.0` section:
  * A short Kloppy-voiced summary of what the app is.
  * A plain factual feature list (chat via local llamafile, notes, reminders
    with OS notifications, tray, summon popup, themes, folder watcher,
    personality modes).
  * The privacy disclosure paragraph already written in
    `kloppy-desktop/README.md` ("Release-note privacy disclosure") — reuse
    it, do not rewrite it.
  * A "Known limitations" list: builds are unsigned (macOS/Windows will
    warn), reminder date parsing is intentionally simple, actions are inert.
* Update both READMEs: the root README's "No packaged release exists yet"
  wording and launch checklist, and the desktop README's version references,
  so they describe the 0.1.0 release process instead of contradicting it.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Prepare v0.1.0 metadata, license, and release notes`

---

# 5. Harden electron-builder config for unsigned cross-platform release

The electron-builder config in `kloppy-desktop/package.json` is minimal.
Finalize it for an explicitly-unsigned v0.1.0 across Linux, macOS, Windows.

Requirements:

* Linux:
  * Keep AppImage + deb. Add proper `desktop` entry fields (Name, Comment,
    Categories) and deb `maintainer`/`synopsis` so lintian-level basics pass.
* macOS:
  * Build for both Intel and Apple Silicon — prefer a universal dmg if the
    config supports it cleanly, otherwise both arches.
  * Make the unsigned state explicit and deterministic: configure identity
    so builds do not fail looking for certificates on CI
    (`CSC_IDENTITY_AUTO_DISCOVERY=false` and/or `mac.identity: null`).
    Research the current electron-builder behavior for ad-hoc signing on
    arm64 — Apple Silicon refuses to launch apps with no signature at all,
    so ensure the produced app is at least ad-hoc signed. Verify against
    electron-builder's docs for the pinned version rather than from memory.
  * Set `dmg` title/contents only if defaults are wrong; do not gold-plate.
  * Leave a clearly marked commented-out TODO block for Developer ID
    signing + notarization.
* Windows:
  * NSIS: `oneClick: false`, per-user install by default, allow the user to
    pick the directory. Sensible shortcut names.
  * Leave a commented-out TODO for Authenticode signing.
* All platforms:
  * Confirm `files` exclusions still keep `models/**`,
    `llamafile-runtime/**`, and `*.download` out of the package. Inspect the
    built asar/artifact to prove it, don't just read the config.
  * Keep the `Kloppy-${version}-${os}-${arch}.${ext}` artifact pattern.
* Add a short "Installing unsigned builds" section to
  `kloppy-desktop/README.md`: macOS right-click → Open and the
  `xattr -cr /Applications/Kloppy.app` fallback for "damaged" warnings;
  Windows SmartScreen "More info → Run anyway"; Linux `chmod +x` for the
  AppImage. This text gets reused verbatim on the website later, so write it
  once, well, in Kloppy's voice with the factual steps intact.
* Verify locally on Linux: `npm run dist:linux`, install/run the AppImage on
  a clean profile (`KLOPPY_USER_DATA_DIR` pointed at a temp dir), and walk
  the smoke-test checklist already in `kloppy-desktop/README.md`. macOS and
  Windows configs will be exercised by CI in the next prompt — note anything
  you could not verify locally.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Finalize unsigned packaging config for linux, macos, windows`

---

# 6. CI and tag-triggered release workflow

There is no `.github/` directory. Add two workflows. The repo on GitHub is
`ImZackAdams/Kloppy-` (trailing hyphen is real).

Requirements:

* `.github/workflows/ci.yml`:
  * Trigger on push and pull_request to `main`.
  * Ubuntu runner is enough for CI; `working-directory: kloppy-desktop`.
  * `npm ci`, `npm test`, `npm run check`.
* `.github/workflows/release.yml`:
  * Trigger on tags matching `v*`.
  * Matrix: `ubuntu-latest`, `macos-latest`, `windows-latest`.
  * Per leg: `npm ci`, `npm test`, `npm run check`, then the matching
    `dist:linux` / `dist:mac` / `dist:win` script.
  * Set `CSC_IDENTITY_AUTO_DISCOVERY: false` on the mac leg (consistent
    with prompt 5).
  * Generate a `SHA256SUMS-<os>.txt` for the leg's artifacts.
  * Upload all artifacts and checksum files to a single **draft** GitHub
    Release for the tag (use a well-maintained action or `gh` CLI; pin
    action versions).
  * No signing/notarization secrets. Leave commented-out TODO steps where
    they would go.
* Do not upload zip targets to the release if dmg/nsis cover the platform —
  fewer, clearer choices on the download page. Either drop the zip targets
  from the workflow upload set or from the builder config, your call; say
  which you chose.
* Update the root README "Deployment" section to describe the flow: tag
  `v0.1.0` → CI builds all three platforms → draft release → manually
  smoke-test → publish.
* You cannot fully verify workflows locally: lint them (e.g. actionlint if
  available), dry-read the syntax carefully, and state clearly that first
  real verification happens on the first tag push.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add CI and draft release workflows`

---

# 7. Website: Downloads section — the distribution channel

`index.html` at the repo root is the getkloppy.com site (single static file,
GitHub Pages, no external JS, no tracking). It has a `STORE` config with a
Stripe test payment link and a newsletter form, but no way to download the
app. Downloads are distributed from this page, linking to GitHub Release
artifacts.

Requirements:

* Add a `DOWNLOADS` config object next to the existing `STORE` object:
  * `version` (e.g. `'0.1.0'`), and per-platform entries for Windows
    (`.exe`), macOS (`.dmg`), Linux AppImage, and Linux deb: each with a
    direct GitHub release asset URL and its SHA-256 string.
  * URLs will look like
    `https://github.com/ImZackAdams/Kloppy-/releases/download/v0.1.0/Kloppy-0.1.0-<os>-<arch>.<ext>`
    — leave them as empty-string placeholders for now with a comment showing
    the exact expected shape; they get filled in by the release runbook
    after the first draft release is published.
* Add a Downloads section (`id="download"`) styled like the existing retro
  `win` cards, one card per platform, showing version, file type, and a
  truncated checksum with a "copy full checksum" affordance.
* Graceful degradation, matching the existing `STORE` pattern: while a URL
  placeholder is empty, the button shows a Kloppy-voiced "not packaged yet /
  he's still in the box" state instead of a dead link.
* Detect the visitor's platform from `navigator` and visually highlight
  their card. No fingerprinting beyond that, nothing sent anywhere.
* Include the "Installing unsigned builds" instructions written in prompt 5
  (macOS right-click → Open / xattr fallback, Windows SmartScreen, Linux
  chmod), as collapsible `details` entries in the existing FAQ style —
  Kloppy-voiced, factual steps intact ("He's not signed. He can't afford
  it.").
* Add a plain link to the GitHub releases page for older versions.
* Wire the nav and the hero/pricing CTAs: the $4.20 Stripe purchase stays,
  reframed as funding the comeback, while the download itself is openly
  available on the page. Adjust the "Download details after checkout" copy
  in the checkout note accordingly. NOTE for the human: this makes the app
  free-to-download with a voluntary $4.20 — a static page cannot enforce a
  paywall anyway. If you want a soft gate instead, the alternative is
  pointing the Stripe Payment Link's post-checkout redirect at a success
  page containing the links; flag your choice in the commit message.
* Keep everything inline in the single file. No frameworks, no external
  requests, no analytics. Site must still work with JS disabled: cards
  render as plain links (or the "not packaged yet" text) without script.
* Update the root README launch checklist: add "fill DOWNLOADS config after
  publishing the release".

Verification: open `index.html` in a browser; check the section renders in
all three site themes if themes apply, the platform highlight works, and no
console errors. Commit locally only.

Suggested commit message:

`Add downloads section as distribution channel`

---

# 8. Release runbook and first tagged release prep

Everything is in place; write down the exact order of operations and prepare
the tag. Pushing is a human decision — this prompt prepares everything and
pushes nothing.

Requirements:

* Create `RELEASE.md` at the repo root with the v0.1.0 runbook:
  1. Confirm clean tree on `main`, tests and checks green.
  2. Confirm version `0.1.0` in `kloppy-desktop/package.json` and release
     notes present.
  3. Human: `git push origin main`, then `git tag v0.1.0 && git push origin
     v0.1.0`.
  4. Watch the release workflow; download the draft-release artifacts.
  5. Smoke-test per the checklist in `kloppy-desktop/README.md`: Linux
     artifact on this machine; macOS and Windows artifacts on real hardware
     (unsigned-open steps documented in the README).
  6. Publish the draft release on GitHub.
  7. Fill the `DOWNLOADS` config in `index.html` with the final asset URLs
     and SHA-256 values from `SHA256SUMS-*.txt`; commit and push `main` so
     Pages serves it.
  8. Verify each download link on the live site resolves and checksums
     match.
* Include a separate "Human-only launch tasks" section (things no prompt can
  do): enable GitHub Pages on `main`, set custom domain getkloppy.com,
  configure DNS, swap the Stripe test payment link for the live one, set the
  newsletter endpoint, set up `hello@getkloppy.com`.
* Cross-check: grep the repo for leftover contradictions ("No packaged
  release exists yet", stale version strings, TODO markers from earlier
  prompts that were resolved) and fix any stragglers in the same commit.
* Do NOT create or push the tag in this prompt.

Run `npm test` and `npm run check`. Commit locally only.

Suggested commit message:

`Add v0.1.0 release runbook`
