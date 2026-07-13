# Kloppy

Domain: getkloppy.com

A legally distinct, cursed desktop assistant for people who miss weird software.
This repo contains both the static marketing site and the Electron desktop app.

## Current Status

Kloppy v0.1.0 is publicly available from the
[GitHub release](https://github.com/ImZackAdams/Kloppy/releases/tag/v0.1.0).
The desktop product lives in `kloppy-desktop/`; the static launch site lives at
the repository root.

The desktop app is runnable from source and has the core local-first MVP:

- Retro Electron assistant window, tray behavior, summon popup, themes, and commentary
- Local notes and reminders stored in Electron `userData`
- Opt-in folder watcher and inert saved action placeholders
- First-run local AI setup with one explicit, checksum-verified model download
- Local llamafile chat with current date/time context, local identity memory, note/reminder commands, and retrieved app context
- No cloud account, telemetry, or data upload

Not done yet: code signing/notarization and safe allowlisted action execution.
OS-level reminder notifications and the stored "launch minimized" setting are
implemented. Installers are built automatically by the tag-triggered
[`release.yml`](.github/workflows/release.yml), but v0.1.0 remains unsigned.

## Local Usage

For the website, open `index.html` in a browser.

Open `whitepaper.html` for the technical white paper.

For the desktop app:

```bash
cd kloppy-desktop
npm install
npm start
```

## Deployment

### Website

The site is a static GitHub Pages deployment from `main`, with the custom domain
configured by [`CNAME`](CNAME). Use [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)
for launch changes and [`ROLLBACK.md`](ROLLBACK.md) if a deployment must be
reverted.

### Desktop App

Continuous integration ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
runs the unit tests and syntax check for pushes to `main` and
`release/v0.1.0`, and for pull requests targeting those branches.

Releases are cut by pushing a version tag; the whole build is automated by
[`.github/workflows/release.yml`](.github/workflows/release.yml):

1. **Tag** a release commit — e.g. `git tag v0.2.0 && git push origin v0.2.0`.
2. **Matrix build.** The workflow fans out to Linux, macOS, and Windows runners,
   re-runs the test + syntax gate on each leg, then packages the installers:
   - Linux — `Kloppy-<version>-linux-x86_64.AppImage`, `Kloppy-<version>-linux-amd64.deb`
   - macOS — `Kloppy-<version>-mac-universal.dmg`
   - Windows — `Kloppy-<version>-win-x64.exe` (NSIS)
3. **Checksums.** Each leg emits a `SHA256SUMS-<os>.txt` beside its installers.
4. **Draft release.** Every installer and checksum file is uploaded to a single
   **draft** GitHub Release (the `.zip` and `.blockmap` artifacts are skipped).
5. **Human smoke-test.** A person downloads each installer, verifies it against
   its `SHA256SUMS-<os>.txt`, and confirms it launches (first-run setup, mascot,
   single-instance focus).
6. **Human publishes** the draft once every OS build checks out.

v0.1.0 ships **unsigned** on all three OSes — see
[Installing unsigned builds](kloppy-desktop/README.md#installing-unsigned-builds)
in the desktop README for what users do to open them. No signing secrets are
wired into CI yet; the TODO markers in `release.yml` and `electron-builder.config.js`
show exactly where they go.

To run from source instead: `cd kloppy-desktop && npm start`. The app downloads
a pinned llamafile only if the user explicitly chooses the first-run setup
option; after that, it works fully offline.

## Launch Operations

- [`CHANGELOG.md`](CHANGELOG.md) — release and website history
- [`LAUNCH_NOTES.md`](LAUNCH_NOTES.md) — current release facts and limitations
- [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) — concise deployment gate
- [`ROLLBACK.md`](ROLLBACK.md) — safe website rollback procedure
- [`STRIPE_SETUP.md`](STRIPE_SETUP.md) — optional one-time contribution setup
- [`RELEASE.md`](RELEASE.md) — future desktop release runbook
