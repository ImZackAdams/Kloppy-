# Kloppy Release Runbook

The step-by-step for cutting a public desktop release. The build itself is
automated by [`.github/workflows/release.yml`](.github/workflows/release.yml);
this runbook covers the human parts around it. Example version below is
`v0.1.0` — substitute the real tag.

## Release steps

1. **Clean tree.** On `release/v0.1.0`, confirm `git status` is clean and you
   are on the right branch.
2. **Tests pass.** From `kloppy-desktop/`, run `npm test` and `npm run check`;
   both must be green before tagging.
3. **Push the branch.** A human pushes the release branch to the remote
   (`git push origin release/v0.1.0`).
4. **Tag the release.** A human tags and pushes the version tag —
   `git tag v0.1.0 && git push origin v0.1.0`. Pushing a `v*` tag is what
   triggers the build.
5. **Watch `release.yml`.** The tag fans out to Linux, macOS, and Windows
   runners, re-runs the test + syntax gate on each leg, packages the
   installers, and collects them into a single **draft** GitHub Release.
   Watch the run and confirm all three legs succeed.
6. **Download artifacts + checksums.** From the draft release, download each
   installer and its `SHA256SUMS-<os>.txt`
   (`SHA256SUMS-Linux.txt`, `SHA256SUMS-macOS.txt`, `SHA256SUMS-Windows.txt`).
   - Linux — `Kloppy-<version>-linux-x86_64.AppImage`,
     `Kloppy-<version>-linux-amd64.deb`
   - macOS — `Kloppy-<version>-mac-universal.dmg`
   - Windows — `Kloppy-<version>-win-x64.exe`
7. **Smoke-test.** Verify each download against its `SHA256SUMS-<os>.txt`, then
   run the manual smoke-test checklist in
   [`kloppy-desktop/README.md`](kloppy-desktop/README.md) — Linux locally,
   macOS and Windows on real hardware (the builds are unsigned, so also confirm
   the "Installing unsigned builds" steps work).
8. **Publish the draft.** Once every OS build checks out, publish the draft
   GitHub Release.
9. **Fill `DOWNLOADS`.** In `index.html`, set each platform's `url` and
   `sha256` in the `DOWNLOADS` config from the published release assets and the
   checksum files (`windows`, `macos`, `linuxAppImage`, `linuxDeb`).
10. **Merge to `main`.** Merge the release branch into `main` so GitHub Pages
    serves the updated site.
11. **Verify live links.** On the live site, confirm each download button links
    to the correct release asset and the version/checksums match.

## Human-only tasks (one-time or out-of-band)

These are not automated and must be done by a person:

- **Enable GitHub Pages** from the `main` branch.
- **Set the getkloppy.com custom domain** and configure DNS with the registrar.
- **Swap the Stripe link.** In `index.html`, replace the test link in
  `STORE.stripePaymentLink` with the live `https://buy.stripe.com/...` link
  (see [`STRIPE_SETUP.md`](STRIPE_SETUP.md)).
- **Set the newsletter endpoint** in `STORE.newsletter` (Formspree, Buttondown,
  etc.).
- **Set up `hello@getkloppy.com`** for the footer contact link.
