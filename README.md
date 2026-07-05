# Kloppy

Domain: getkloppy.com

A legally distinct, cursed desktop assistant for people who miss weird software.
This repo contains both the static marketing site and the Electron desktop app.

## Current Status

As of July 5, 2026, `main` is the canonical branch locally and on GitHub.
The active product work is in `kloppy-desktop/`.

The desktop app is runnable from source and has the core local-first MVP:

- Retro Electron assistant window, tray behavior, summon popup, themes, and commentary
- Local notes and reminders stored in Electron `userData`
- Opt-in folder watcher and inert saved action placeholders
- First-run local AI setup with one explicit, checksum-verified model download
- Local llamafile chat with current date/time context, local identity memory, note/reminder commands, and retrieved app context
- No cloud account, telemetry, or data upload

Not done yet: packaged installers, code signing/notarization, OS-level reminder notifications, honoring the stored "launch minimized" setting, and safe allowlisted action execution.

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

No packaged release exists yet. For now, run from source with `npm start`.
The app downloads a pinned llamafile only if the user explicitly chooses the
first-run setup option; after that, it works fully offline.

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
