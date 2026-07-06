# Kloppy v0.1.0 Release Prompts — Commit After Each Phase, Do Not Push

## Goal

Take Kloppy from its current source-runnable state to a **minimal, polished, public v0.1.0 desktop release**: unsigned installers for Linux, macOS, and Windows, built by CI, hosted on GitHub Releases, and downloadable from the `index.html` marketing site at getkloppy.com.

Ship simple and shippable. Do not gold-plate.

Each phase below is small, focused, self-contained, and safe to hand to a fresh Claude Code / Codex session one at a time.

**Important behavior change:**
After each phase, make a local git commit with the specified commit message.

**Do not push. Do not create tags. Do not merge branches.**

---

## Current repo assumptions

* You are working in the Kloppy repo.
* Active branch should be `release/v0.1.0`, not `main`.
* `release/v0.1.0` is the release branch for this work.
* App source is in `kloppy-desktop/`.
* Root `index.html` is the getkloppy.com static site.
* GitHub remote is:

```bash
https://github.com/ImZackAdams/Kloppy-.git
```

The trailing hyphen in the repo name is real. Do not “fix” it.

Preserve the existing security posture:

* `contextIsolation` on.
* `nodeIntegration` off.
* Renderer is untrusted.
* Renderer talks to main only through the `window.kloppy` preload bridge.
* Validation and state live in the main process.
* User data stays in Electron `userData`.
* Local-first behavior.
* One opt-in model download.
* Static site stays a single inline `index.html`.
* No external JS, trackers, analytics, or frameworks.

Out of scope for v0.1.0:

* Code signing.
* Notarization.
* Action execution.
* Rich reminder parsing.
* Import/export.

---

## Global instructions for every phase

You are working in the Kloppy repo on branch:

```bash
release/v0.1.0
```

Before starting each phase:

1. Confirm the current branch is `release/v0.1.0`.
2. Confirm the working tree is clean.
3. If the tree is not clean, stop and report the current `git status`. Do not stash, discard, amend, or overwrite anything without explicit human instruction.

During each phase:

* Keep the diff small and focused.
* Do not do unrelated refactors.
* Do not change architecture.
* Do not add npm dependencies unless that phase explicitly allows it.
* Preserve project conventions.
* Trust the repo if reality differs from these instructions, and report the difference.

For any desktop app change, run from `kloppy-desktop/`:

```bash
npm test
npm run check
```

Baseline expectation: all tests pass.

To launch the app locally on this machine, use:

```bash
env -u ELECTRON_RUN_AS_NODE npm start
```

from inside `kloppy-desktop/`.

VSCode may set `ELECTRON_RUN_AS_NODE`, which breaks Electron.

Verification should be token-efficient. Prefer a cheaper/faster model for behavioral checks where possible. Summarize changes; do not dump whole files.

At the end of each phase:

1. Run the required verification.
2. Review `git diff`.
3. Stage only the files intentionally changed for that phase.
4. Make a local commit using the exact commit message listed for that phase.
5. Confirm `git status` is clean after the commit.
6. Do not push.
7. Do not create tags.

---

# Phase 1 — Stabilize the release branch and working tree

## Purpose

Establish a known-good v0.1.0 baseline on `release/v0.1.0` and remove doc statements that contradict shipping a release. Do not touch app behavior.

## Requirements

* Confirm branch is `release/v0.1.0`.
* Confirm working tree is clean before editing.
* In `kloppy-desktop/`, run:

```bash
npm test
npm run check
```

* Reword only stale release-status prose:

  * Root `README.md`

    * The line saying `main` is the canonical branch.
    * The Deployment line saying no packaged release exists yet.
  * `kloppy-desktop/README.md`

    * The status line saying “As of July 5, 2026 … main.”
* State that `release/v0.1.0` is the active branch preparing the first public v0.1.0 desktop release.
* Keep edits short and factual.
* Do not rewrite whole sections.
* Do not change app code.
* Do not change electron-builder config.
* Do not modify the trailing-hyphen GitHub repo URL.

## Likely files

* `README.md`
* `kloppy-desktop/README.md`

## Verification

* `npm test` passes.
* `npm run check` passes.
* `git status` shows only the two README files changed before commit.

## Commit

Stage only the intended docs changes, then commit:

```bash
git add README.md kloppy-desktop/README.md
git commit -m "docs: set release/v0.1.0 as active release branch"
```

Do not push.

---

# Phase 2 — Minimal app polish: release menu and About version

## Purpose

Remove dev-only affordances from the packaged app menu and show the app version in the About panel.

## Requirements

In `src/main.js`, set a release-appropriate application menu:

* Windows/Linux:

  * Remove the menu bar entirely in packaged builds.
  * Use `Menu.setApplicationMenu(null)` or equivalent.
  * Reload and Toggle DevTools must not ship in the packaged app.

* macOS:

  * Keep a minimal menu.
  * Include the standard app menu.
  * Include an Edit menu using roles:

    * undo
    * redo
    * cut
    * copy
    * paste
    * selectAll
  * Do not ship a View menu in packaged builds.

* Development:

  * When `!app.isPackaged`, keep DevTools reachable.
  * Use the default menu or a dev-only accelerator.

Surface the app version to the renderer:

* Add one read-only IPC handler in main, such as `app:version`.
* Back it with `app.getVersion()`.
* Expose it through `src/preload.js` using the existing `window.kloppy.*` pattern.
* Show the version in the existing About panel in `src/renderer/app.js`.
* Use Kloppy’s voice, for example:

```text
kloppy.exe v0.1.0 — still here
```

Locate the About panel in the code instead of assuming line numbers.

Confirm text inputs still support copy/paste on the paths you can test.

## Likely files

* `kloppy-desktop/src/main.js`
* `kloppy-desktop/src/preload.js`
* `kloppy-desktop/src/renderer/app.js`
* Possibly an existing test if there is a clean pattern to extend.

## Verification

From `kloppy-desktop/`:

```bash
npm test
npm run check
env -u ELECTRON_RUN_AS_NODE npm start
```

Confirm:

* Packaged-release menu behavior is clean.
* DevTools remain available in development.
* Linux/Windows packaged behavior removes menu bar.
* macOS keeps clipboard shortcuts through the Edit menu.
* About panel shows the live version.
* Copy/paste still works in text inputs.

## Commit

Stage only the intended app changes, then commit:

```bash
git add kloppy-desktop/src/main.js kloppy-desktop/src/preload.js kloppy-desktop/src/renderer/app.js
git commit -m "feat(desktop): release menu and About version"
```

If you changed a test, stage that test too.

Do not push.

---

# Phase 3 — Application icon for packaged builds

## Purpose

Replace the default Electron icon with the Kloppy mascot so packaged builds look intentional.

## Requirements

* Provide a square master icon at:

```bash
kloppy-desktop/build/icon.png
```

* Icon must be at least 512×512.
* 1024×1024 is preferred.
* Prefer generating it from the existing pixel art in `src/tray-icon.js`, using `ART` and `PALETTE`.
* Use crisp nearest-neighbor scaling.
* Prefer a small no-dependency script.
* No new npm dependencies.

Acceptable approaches:

1. Add a generator script such as:

```bash
kloppy-desktop/scripts/generate-icon.js
```

using Node built-ins or Electron APIs.

2. If generation is too fiddly, commit a single pre-rendered PNG.

If adding a generator:

* Add an npm script such as:

```json
"icon:generate": "node scripts/generate-icon.js"
```

* Avoid duplicating tray art.
* Keep tray behavior unchanged.

Packaging:

* Let electron-builder pick up `build/icon.png`.
* Verify whether the pinned electron-builder version needs explicit `mac.icon` or `win.icon`.
* Add explicit config only if needed.
* Ensure `build/` is not ignored.
* Ensure `build/` is not bundled inside the app.

Build and verify:

```bash
npm run build:unpacked
```

Confirm the unpacked Linux app uses the mascot icon, not the default Electron icon.

## Likely files

* `kloppy-desktop/build/icon.png`
* `kloppy-desktop/package.json`
* Possibly `kloppy-desktop/scripts/generate-icon.js`
* Possibly `kloppy-desktop/src/tray-icon.js`

## Verification

From `kloppy-desktop/`:

```bash
npm test
npm run check
npm run build:unpacked
```

Confirm:

* Packaged/unpacked build uses the Kloppy icon.
* Tray behavior still works.
* No new dependencies were added.

## Commit

Stage only intended icon-related files, then commit:

```bash
git add kloppy-desktop/build/icon.png kloppy-desktop/package.json
git commit -m "feat(desktop): app icon for packaged builds"
```

If you added a script or touched tray icon source, include those files too.

Do not push.

---

# Phase 4 — Versioning and release metadata

## Purpose

Stamp the release version and align metadata everywhere it is named.

## Requirements

* Bump `kloppy-desktop/package.json` version:

```text
0.0.1 → 0.1.0
```

* Confirm `homepage` is sensible for getkloppy.com.
* Confirm `author` is sensible.
* Do not invent a legal entity.
* Update docs so version references match `0.1.0`.
* Example artifact names in `kloppy-desktop/README.md` should use `0.1.0`.
* Do not hardcode a version into the `artifactName` pattern if it already uses `${version}`.
* Do not tag.

## Likely files

* `kloppy-desktop/package.json`
* `kloppy-desktop/package-lock.json`, if version lock metadata updates
* `kloppy-desktop/README.md`
* Possibly root `README.md`

## Verification

From `kloppy-desktop/`:

```bash
npm test
npm run check
```

Then grep for stale version references:

```bash
grep -R "0.0.1" -n . ..
```

Fix stale doc references, but do not blindly modify package-lock internals unless npm updated them naturally.

## Commit

Stage only intended version and docs metadata changes, then commit:

```bash
git add kloppy-desktop/package.json kloppy-desktop/README.md README.md
git commit -m "chore: bump version to 0.1.0"
```

If `package-lock.json` changed, include it.

Do not push.

---

# Phase 5 — LICENSE and release notes

## Purpose

Add the license promised by `package.json` and create human-readable v0.1.0 release notes.

## Requirements

* Add a standard MIT `LICENSE` file at the repo root.
* Copyright:

  * Current year.
  * Project owner from git author identity.
  * Do not invent a legal entity.

Add:

```bash
kloppy-desktop/RELEASE_NOTES.md
```

Include a `v0.1.0` section with:

* A short Kloppy-voiced summary of what the app is.
* A factual feature list drawn from actual modules:

  * local llamafile chat
  * notes
  * reminders with OS notifications
  * tray + close-to-hide
  * summon popup
  * themes, including dark mode and mood settings
  * personality modes
  * local chat history
  * local memories
  * opt-in folder watcher
  * inert action placeholders
  * guided first-run model setup
* Reuse the “Release-note privacy disclosure” paragraph already in `kloppy-desktop/README.md` verbatim.
* Do not rewrite that disclosure.
* Add a Known limitations list:

  * Builds are unsigned, so macOS and Windows will warn.
  * Reminder date parsing is intentionally simple.
  * Actions are inert and never execute.

Keep release notes short. This text will be reused on the website later.

## Likely files

* `LICENSE`
* `kloppy-desktop/RELEASE_NOTES.md`
* Optionally README links

## Verification

From `kloppy-desktop/`:

```bash
npm test
npm run check
```

Confirm the feature list matches actual modules such as:

* `chats.js`
* `memories.js`
* `personality.js`

## Commit

Stage only intended license/release-note files, then commit:

```bash
git add LICENSE kloppy-desktop/RELEASE_NOTES.md
git commit -m "docs: add MIT LICENSE and v0.1.0 release notes"
```

If README links were added, stage those too.

Do not push.

---

# Phase 6 — Finalize unsigned packaging for Linux, macOS, and Windows

## Purpose

Make electron-builder produce deterministic, explicitly unsigned v0.1.0 builds on all three OSes, and document how users open unsigned builds.

## Requirements

Linux:

* Keep AppImage and deb.
* Add desktop-entry fields:

  * Name
  * Comment
  * Categories
* Add deb metadata:

  * maintainer
  * synopsis

macOS:

* Build for both Intel and Apple Silicon.
* Prefer a universal dmg if cleanly supported.
* Otherwise configure both arches.
* Make unsigned state explicit and CI-safe.
* Set `CSC_IDENTITY_AUTO_DISCOVERY=false` where appropriate.
* Ensure builds do not fail looking for certificates.
* Ensure the produced `.app` is at least ad-hoc signed so Apple Silicon can launch it.
* Verify current behavior against the pinned electron-builder docs/config reality instead of relying on memory.
* Add a clearly marked commented-out TODO block for Developer ID signing and notarization.

Windows:

* NSIS installer.
* `oneClick: false`.
* Per-user install by default.
* Allow user to choose install directory.
* Use sensible shortcut names.
* Add a commented-out TODO for Authenticode signing.

All platforms:

* Keep artifact pattern:

```text
Kloppy-${version}-${os}-${arch}.${ext}
```

* Confirm package exclusions keep these out of the app:

  * `models/**`
  * `llamafile-runtime/**`
  * `*.download`
* Inspect the built asar/artifact to prove exclusions, not just the config.

Docs:

Add an “Installing unsigned builds” section to `kloppy-desktop/README.md` with:

* macOS:

  * right-click → Open
  * fallback:

```bash
xattr -cr /Applications/Kloppy.app
```

* Windows:

  * SmartScreen → More info → Run anyway
* Linux:

  * `chmod +x` the AppImage

Write it once in Kloppy’s voice, with factual steps intact. This text will be reused on the website later.

Local verification is Linux only:

```bash
npm run dist:linux
```

Run the AppImage against a temp profile:

```bash
KLOPPY_USER_DATA_DIR="$(mktemp -d)" ./release/<actual-appimage-name>
```

Walk the smoke-test checklist in `kloppy-desktop/README.md`.

macOS and Windows packaging will be first exercised by CI in the next phase.

## Likely files

* `kloppy-desktop/package.json`
* `kloppy-desktop/README.md`

## Verification

From `kloppy-desktop/`:

```bash
npm test
npm run check
npm run dist:linux
```

Confirm:

* AppImage produced.
* deb produced.
* Model/runtime/download files are excluded.
* AppImage smoke test works against a temp profile.

## Commit

Stage only intended packaging and README changes, then commit:

```bash
git add kloppy-desktop/package.json kloppy-desktop/README.md
git commit -m "build: finalize unsigned packaging for linux, macos, windows"
```

Do not push.

---

# Phase 7 — CI and tag-triggered release workflow with checksums

## Purpose

Run tests on the release branch automatically, and on a version tag build all three OSes and publish them with checksums to a draft GitHub Release.

GitHub Releases is the artifact host.

## Requirements

Create:

```bash
.github/workflows/ci.yml
```

Triggers:

* `push` to:

  * `release/v0.1.0`
  * `main`
* `pull_request` to:

  * `release/v0.1.0`
  * `main`

Runner:

* Ubuntu

Working directory:

```bash
kloppy-desktop
```

Steps:

```bash
npm ci
npm test
npm run check
```

Create:

```bash
.github/workflows/release.yml
```

Trigger:

```yaml
on:
  push:
    tags:
      - "v*"
```

Matrix:

* `ubuntu-latest`
* `macos-latest`
* `windows-latest`

Each leg:

```bash
npm ci
npm test
npm run check
```

Then matching dist command:

* Linux: `npm run dist:linux`
* macOS: `npm run dist:mac`
* Windows: `npm run dist:win`

macOS leg:

* Set:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false
```

Checksums:

* Each OS leg generates:

```text
SHA256SUMS-<os>.txt
```

over its produced artifacts.

GitHub Releases:

* Upload installers plus checksum files to one draft Release for the tag.
* Use `gh` CLI or a well-maintained action.
* Pin action versions.
* No signing or notarization secrets.
* Leave commented-out TODO steps where signing/notarization would go.

Download noise:

* Do not upload zip targets if dmg/nsis already cover the platform.
* Either drop zip targets from upload set or from builder config.
* State which approach was chosen in the summary.

Docs:

Update root `README.md` Deployment section to describe:

1. Push `release/v0.1.0`.
2. Tag `v0.1.0`.
3. Matrix builds Linux/macOS/Windows.
4. Draft release is created with checksums.
5. Human smoke-tests.
6. Human publishes.

Do not push.
Do not create the tag.

## Likely files

* `.github/workflows/ci.yml`
* `.github/workflows/release.yml`
* `README.md`

## Verification

* Run `actionlint` if available.
* Carefully inspect the YAML if `actionlint` is unavailable.
* Confirm artifact names match packaging config.
* Confirm checksum names match upload paths.
* State clearly that first full verification happens on first tag push.

## Commit

Stage only intended workflow and README changes, then commit:

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml README.md
git commit -m "ci: add CI and draft release workflows"
```

Do not push.

---

# Phase 8 — Website downloads section as distribution channel

## Purpose

Turn `index.html` into the download channel, sourcing artifacts from GitHub Releases and surfacing checksums.

## Requirements

Add a `DOWNLOADS` config object next to the existing `STORE` object in `index.html`.

Shape:

```js
const DOWNLOADS = {
  version: '0.1.0',
  platforms: {
    windows: {
      label: 'Windows',
      fileType: '.exe',
      url: '',
      sha256: ''
    },
    macos: {
      label: 'macOS',
      fileType: '.dmg',
      url: '',
      sha256: ''
    },
    linuxAppImage: {
      label: 'Linux AppImage',
      fileType: '.AppImage',
      url: '',
      sha256: ''
    },
    linuxDeb: {
      label: 'Linux deb',
      fileType: '.deb',
      url: '',
      sha256: ''
    }
  }
};
```

Include a comment showing the exact intended URL shape:

```text
https://github.com/ImZackAdams/Kloppy-/releases/download/v0.1.0/Kloppy-0.1.0-<os>-<arch>.<ext>
```

Leave URLs and checksums as empty-string placeholders for now. They will be filled after the draft release is published.

Add a Downloads section:

```html
<section id="download">
```

Style it like the existing retro `win` cards.

Include:

* One card per platform.
* Version.
* File type.
* Truncated checksum.
* “Copy full checksum” affordance.

Graceful degradation:

* If URL is empty, do not render a dead link.
* Show Kloppy-voiced not-ready text, such as:

```text
still in the box / not packaged yet
```

* Page must work with JS disabled.
* Cards should render as plain links or not-ready text without script.

Platform detection:

* Use `navigator` only to visually highlight the likely platform card.
* No fingerprinting beyond that.
* Send nothing anywhere.

Unsigned install instructions:

* Reuse the “Installing unsigned builds” steps from Phase 6.
* Add them as collapsible `details` entries in the existing FAQ style.
* Keep the factual steps intact.
* Kloppy voice is fine, for example:

```text
He’s not signed. He can’t afford it.
```

Other links:

* Add a plain link to the GitHub Releases page for older versions.

$4.20 support CTA:

* Keep the Stripe CTA as voluntary support.
* Make downloads openly available on the page.
* Adjust any “Download details after checkout” copy accordingly.
* Add a code or HTML comment noting:

  * The app is free-to-download with voluntary $4.20 support.
  * A static page cannot enforce a paywall.
  * Soft-gate alternative: Stripe Payment Link post-checkout redirect to a success page containing links.

No external dependencies:

* Keep everything inline in the single file.
* No frameworks.
* No external requests.
* No analytics.

Docs:

Update root `README.md` launch checklist to include:

```text
Fill DOWNLOADS config after publishing the release.
```

## Likely files

* `index.html`
* `README.md`

## Verification

Open `index.html` in a browser and confirm:

* Downloads section renders.
* Platform highlight works.
* Cards work with placeholder URLs.
* No dead links for empty placeholders.
* No console errors.
* Themes still look correct.
* Page degrades gracefully with JS disabled.

## Commit

Stage only intended site and README changes, then commit:

```bash
git add index.html README.md
git commit -m "feat(site): downloads section as distribution channel"
```

Important note for commit summary/response:

```text
This makes Kloppy free-to-download with voluntary $4.20 support. A static page cannot enforce a paywall.
```

Do not push.

---

# Phase 9 — Release runbook and human-only launch tasks

## Purpose

Write the exact order of operations to ship v0.1.0 and enumerate steps only a human can do.

Prepare everything. Push and tag nothing.

## Requirements

Create:

```bash
RELEASE.md
```

Add a v0.1.0 runbook:

1. Confirm clean tree on `release/v0.1.0`.
2. Confirm from `kloppy-desktop/`:

```bash
npm test
npm run check
```

3. Confirm version is `0.1.0`.
4. Confirm `kloppy-desktop/RELEASE_NOTES.md` exists.
5. Human pushes the release branch:

```bash
git push origin release/v0.1.0
```

6. Human creates and pushes tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

7. Watch `release.yml`.
8. Download draft-release artifacts and `SHA256SUMS-*.txt`.
9. Smoke-test:

   * Linux artifact on this machine.
   * macOS artifact on real hardware.
   * Windows artifact on real hardware.
   * Use documented unsigned-open steps.
10. Publish the draft GitHub Release.
11. Fill the `DOWNLOADS` config in `index.html` with:

* Final asset URLs.
* SHA-256 values from `SHA256SUMS-*.txt`.

12. Publish the site.

* Human decides GitHub Pages source branch.
* Default path: merge `release/v0.1.0` into `main`, serving Pages from `main`, matching existing `CNAME`.
* Land the final `DOWNLOADS` commit there.

13. Verify:

* Each live download link resolves.
* Each checksum matches.

Add a “Human-only launch tasks” section:

* Enable GitHub Pages.
* Set GitHub Pages source branch.
* Set custom domain:

```text
getkloppy.com
```

* Configure DNS at registrar.
* Swap test `buy.stripe.com` link for live link in `STORE.stripePaymentLink`.
* Set newsletter endpoint in `STORE.newsletter`.
* Set up support/footer email:

```text
hello@getkloppy.com
```

Cross-check:

* Grep the repo for leftover contradictions:

  * `No packaged release exists yet`
  * stale `0.0.1`
  * resolved TODO markers that should not remain
* Fix small doc stragglers only.
* Do not create or push the tag.

## Likely files

* `RELEASE.md`
* Possibly small README/doc fixes

## Verification

From `kloppy-desktop/`:

```bash
npm test
npm run check
```

Confirm:

* Runbook matches release workflow from Phase 7.
* Runbook matches `DOWNLOADS` config from Phase 8.
* Human-only tasks are clearly separated.
* No pushes or tags were created.

## Commit

Stage only intended runbook/doc changes, then commit:

```bash
git add RELEASE.md README.md kloppy-desktop/README.md index.html
git commit -m "docs: add v0.1.0 release runbook"
```

Only include files that actually changed.

Do not push.

---

# After all phases

After all nine phases, there should be nine local commits on `release/v0.1.0`.

Expected result:

* Clean release branch baseline.
* Release-clean desktop menu.
* About panel shows real app version.
* Kloppy app icon.
* Version bumped to `0.1.0`.
* MIT license.
* v0.1.0 release notes.
* Unsigned packaging for Linux, macOS, and Windows.
* Install instructions for unsigned builds.
* CI workflow.
* Tag-triggered draft release workflow.
* Checksums.
* Website downloads section.
* Release runbook.
* Human-only launch checklist.

Do not push anything automatically.

The human performs launch from `RELEASE.md`:

```bash
git push origin release/v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

Then the human smoke-tests artifacts, publishes the GitHub Release, fills the website download URLs/checksums, and ships the site.
