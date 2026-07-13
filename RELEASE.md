# Kloppy Release Runbook

The step-by-step for cutting a future public desktop release. The build itself
is automated by [`.github/workflows/release.yml`](.github/workflows/release.yml);
this runbook covers the human parts around it. Kloppy v0.1.0 is already public,
so substitute the new version and release branch everywhere below.

## Release steps

1. **Clean tree.** On `release/vX.Y.Z`, confirm `git status` is clean and you
   are on the right branch.
2. **Tests pass.** From `kloppy-desktop/`, run `npm test` and `npm run check`;
   both must be green before tagging.
3. **Push the branch.** A human pushes the release branch to the remote
   (`git push origin release/vX.Y.Z`).
4. **Tag the release.** A human tags and pushes the version tag —
   `git tag vX.Y.Z && git push origin vX.Y.Z`. Pushing a `v*` tag is what
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
9. **Update the centralized release data.** In `index.html`, change the visible
   `#current-release` URL/version and update artifact filenames and checksums in
   `RELEASE.assets`. Direct artifact URLs are derived from the one visible
   release URL and must not be duplicated.
10. **Merge to `main`.** Merge the release branch into `main` so GitHub Pages
    serves the updated site.
11. **Verify live links.** On the live site, confirm each download button links
    to the correct release asset and the version/checksums match.

## Human-only tasks (per release or out-of-band)

These are not automated and must be done by a person:

- **Smoke-test every OS artifact on matching hardware.** CI packaging success is
  not a substitute for launching the unsigned application.
- **Publish the draft release** only after artifact checksums and smoke tests
  pass.
- **Keep GitHub Pages, the custom domain, DNS, and `hello@getkloppy.com` healthy.**
- **Verify the optional Stripe contribution independently.** It does not sell or
  unlock the application; see [`STRIPE_SETUP.md`](STRIPE_SETUP.md).
- **Run the website deployment gate** in
  [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md).
