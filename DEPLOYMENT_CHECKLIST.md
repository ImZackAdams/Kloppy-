# Deployment Checklist

## Before merge

- [ ] Review every changed file; exclude unrelated work from the commit.
- [ ] Confirm branch is `launch/kloppy_came_back` and CI targets `main`.
- [ ] Run `npm run check`, `npm test`, and `npm run build` in `kloppy-desktop/`.
- [ ] Confirm version `0.1.0`, release URL, artifact filenames, and checksums.
- [ ] Confirm every internal link, CTA, and accessible label in desktop and
  mobile layouts.
- [ ] Confirm GitHub artifact links and the Stripe checkout return success.
- [ ] Inspect the 1200 × 630 Open Graph image and favicon.
- [ ] Record `origin/main` for rollback.

## Deploy

- [ ] Merge the reviewed pull request into `main` without force-pushing.
- [ ] Push `main` and wait for the configured GitHub Pages deployment.

## After deploy

- [ ] Open `https://getkloppy.com/` in a private desktop window and a mobile
  viewport; check the console and horizontal overflow.
- [ ] Test every download, the release page, white paper, certificate flow, FAQ,
  mail link, and optional $4.20 checkout without completing payment.
- [ ] Validate page title, description, canonical URL, favicon, and social card
  with platform debuggers.
- [ ] Confirm no analytics, cookies, unexpected network calls, or certificate
  name transmission.
- [ ] If a blocking issue appears, follow [`ROLLBACK.md`](ROLLBACK.md).
