# Kloppy

Domain: getkloppy.com

A legally distinct, cursed desktop assistant for people who miss weird software.
This repo contains both the static marketing site and the Electron desktop app.

## Current Status

The `release/v0.1.0` branch is active, preparing the first public v0.1.0
desktop release. The active product work is in `kloppy-desktop/`.

The desktop app is runnable from source and has the core local-first MVP:

- Retro Electron assistant window, tray behavior, summon popup, themes, and commentary
- Local notes and reminders stored in Electron `userData`
- Opt-in folder watcher and inert saved action placeholders
- First-run local AI setup with one explicit, checksum-verified model download
- Local llamafile chat with current date/time context, local identity memory, note/reminder commands, and retrieved app context
- No cloud account, telemetry, or data upload

Not done yet: code signing/notarization and safe allowlisted action execution. (OS-level reminder notifications and honoring the stored "launch minimized" setting are done; installers are now built automatically by the tag-triggered [`release.yml`](.github/workflows/release.yml), though they still ship unsigned.)

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

Push `main` to GitHub.

Enable GitHub Pages from the main branch.

Set the custom domain to getkloppy.com.

Configure DNS with the domain registrar separately.

### Desktop App

Continuous integration ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
runs the unit tests and syntax check on every push and pull request to `main`
and `release/v0.1.0`.

Releases are cut by pushing a version tag; the whole build is automated by
[`.github/workflows/release.yml`](.github/workflows/release.yml):

1. **Tag** a release commit — e.g. `git tag v0.1.0 && git push origin v0.1.0`.
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

## Launch Checklist

- [x] Create GitHub repo
- [x] Add remote
- [x] Push main branch
- [x] Consolidate current work onto `main`
- [ ] Enable Pages
- [ ] Add custom domain
- [ ] Configure DNS
- [ ] Create the $4.20 Stripe Payment Link using `STRIPE_SETUP.md`
- [ ] Paste the live `https://buy.stripe.com/...` link into `STORE.stripePaymentLink` in `index.html`
- [ ] Set the newsletter endpoint in the same `STORE` config (Formspree, Buttondown, etc.)
- [ ] Set up `hello@getkloppy.com` (footer contact link)
- [ ] Package desktop builds for Linux/macOS/Windows
- [ ] Add release/update notes for the first downloadable build
- [ ] Fill the `DOWNLOADS` config in `index.html` after publishing the release (per-platform URLs + SHA-256 checksums)
