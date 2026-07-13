# Kloppy came back: shipped product homepage and viral launch loop

## Summary

- Put verified free downloads immediately after the hero.
- Add the client-side Certificate of Forgiveness sharing loop.
- Complete launch-readiness metadata, accessibility, privacy, and operations
  documentation.
- Clarify that the famous 69 commits describe the original v0.1.0
  application-and-launch state, not the repository's permanent total.

## Previous and updated behavior

Previously, visitors had to move through the comeback narrative before reaching
distribution information, the site described v0.1.0 as not yet released, and
the contribution runbook implied future download fulfillment. Social previews
had no image and the 69-commit line read like a live total.

Now, the primary CTA leads directly to centralized, checksum-verified artifacts;
unsupported platforms have no links; payment is explicitly optional; certificate
generation stays client-side; social metadata is complete; and all historical
release claims match the repository history.

## Screenshots needed

- Desktop at 1440 px: hero and download cards.
- Desktop at 1440 px: Certificate of Forgiveness result and optional tip section.
- Mobile at 390 px: hero, downloads, generated certificate, and FAQ.
- Social debugger preview using `assets/kloppy-social.png`.
- Stripe-hosted checkout showing one-time USD $4.20 without completing payment.

## Testing performed

- `npm run check` — passed.
- `npm test` — passed, 62/62 tests.
- `npm run build` — passed; electron-builder produced the Linux x64 unpacked
  application with no build warnings.
- `npm run lint` — not available; this repository's syntax gate is
  `npm run check`.
- Static internal-link, accessible-name, alternative-text, metadata, release
  centralization, checksum, and social-image dimension audit — passed.
- Firefox at 1440 px and the 500 px narrow breakpoint — no horizontal overflow,
  missing names, unsafe new-window links, or page-script errors.
- Real keyboard Tab order and interactive Certificate of Forgiveness generation,
  sanitization, focus, download enablement, and share/copy fallback — passed.
- External HTTP checks for the GitHub release, every artifact, live site, white
  paper, and Stripe Payment Link — all returned 200.
- Local homepage load — 66 ms in the audit environment, 83,313-byte HTML body,
  with only the local certificate script and favicon requested.

## Release link verification

The public v0.1.0 release and four website artifacts were compared with the
published release asset list and platform checksum files. The site derives each
download from the single visible v0.1.0 release URL. See
[`LAUNCH_NOTES.md`](LAUNCH_NOTES.md) for exact artifact names and SHA-256 values.
The Stripe page returned successfully and displayed `Kloppy Fund` with a one-time
$4.20 total; no payment was submitted.

## Accessibility checks

- Skip links, visible focus states, landmarks, headings, labels, live regions,
  and all link/button accessible names reviewed.
- Certificate generation is keyboard operable and its canvas has a text
  transcript.
- Decorative SVGs and interface chrome are hidden from assistive technology;
  meaningful mascot/demo visuals have text alternatives.
- Narrow layouts were checked for horizontal overflow and usable controls.

## Deployment steps

1. Complete [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md).
2. Merge the reviewed pull request into `main` without rewriting history.
3. Push `main`; GitHub Pages serves the static site from the configured source.
4. Verify the custom domain, metadata image, downloads, checkout, certificate,
   and browser console on the live site.

## Rollback steps

Follow [`ROLLBACK.md`](ROLLBACK.md): revert the merge commit on `main`, push the
revert, wait for GitHub Pages, and verify the previous site. Do not delete or
retag the v0.1.0 desktop release.

## Known limitations

- All v0.1.0 desktop packages are unsigned; macOS is not notarized.
- Windows ARM, Linux ARM, mobile, and web app artifacts are unavailable.
- Minimum OS version floors have not been formally tested or declared.
- Final installer launch checks require real matching OS hardware.
- Clipboard/Web Share availability varies by browser.
- GitHub and Stripe availability remain external dependencies after a visitor
  explicitly follows those links.
- Stripe's hosted checkout requests email, payment, and tax-calculation details;
  those fields and retention are controlled by Stripe, not the static site.
