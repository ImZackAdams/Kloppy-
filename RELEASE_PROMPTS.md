# Release Prompts

Kloppy v0.1.0 release plan — five self-contained prompts to paste into Claude
Code or Codex, one per session, in order. Generated 2026-07-09 from direct
inspection of branch `release/v0.1.0`.

## Project Snapshot

Kloppy is a "legally distinct" retro desktop gremlin assistant: a local-first
Electron app (notes, reminders, opt-in folder watcher, tray, summon popup,
personality modes, local llamafile AI chat on `127.0.0.1`) in `kloppy-desktop/`,
plus a single inline `index.html` marketing site (GitHub Pages, getkloppy.com,
$4.20 Stripe support link). Vanilla JS, no frameworks, no build step. Electron
41 + electron-builder 24.13.3. Remote: `https://github.com/ImZackAdams/Kloppy-.git`
(trailing hyphen is real).

Verified 2026-07-09: 51 tests pass, `npm run check` passes, version is 0.1.0.
**Already landed — do not redo:** release menu + About version (`ffd69fb`), app
icon (`45f6c60`), full unsigned packaging config for Linux/macOS/Windows incl.
the macOS ad-hoc sign hook (`3aa5086`).

**Missing:** `LICENSE`, `kloppy-desktop/RELEASE_NOTES.md`, `.github/workflows/`,
downloads section in `index.html`, `RELEASE.md` runbook. **Known-stale docs:**
root README "Not done yet" line (OS reminder notifications and launch-minimized
ARE implemented — see `src/main.js:436`); desktop README theme list ("midnight /
beige / toxic green" — real themes are `light | dark`, `src/settings.js:25`);
stale comment at `src/settings.js:12` ("wired up in a future version").

**MVP target:** unsigned v0.1.0 installers (Linux AppImage/deb, macOS universal
dmg, Windows NSIS) built by a tag-triggered GitHub Actions matrix, published
with SHA-256 checksums to a draft GitHub Release, downloadable from getkloppy.com.

## Release Strategy

Small phases, minimal diffs, preserve working behavior. Verify-then-fix: app
prompts exercise behavior first and fix only proven defects — "nothing to
change" is a valid outcome. Prioritize release collateral (CI, downloads page,
docs) over features. Out of scope for v0.1.0: signing/notarization, action
execution, rich reminder parsing, import/export, auto-update. Biggest
token-waste risk: redoing the already-landed menu/icon/packaging work.

## Token Conservation Rules

1. Inspect only files named in the prompt; grep inside big files
   (`src/renderer/app.js` 1.7k lines, `src/llm.js` 1k, `index.html` 1.6k)
   instead of reading them end-to-end.
2. Targeted edits, small reviewable diffs; no reformatting, no regenerating
   large files, no drive-by refactors.
3. Summarize findings briefly before editing; never dump whole files.
4. Reuse existing patterns: `window.kloppy` preload bridge, `settings.js`
   validation style, `storage.js` durable JSON, existing `test/*.test.js`
   files, the site's retro `win` card markup.
5. Narrowest check first: `npm run check` (fast) → `npm test` (~10s) → builds
   only when the prompt says so.
6. Prompts 4–5 suit a cheaper model where marked; 1–3 need a strong coding model.
7. Fresh chat per prompt; carry state via each prompt's short deliverable
   summary only.
8. Commit only if the user explicitly says so (each prompt suggests a message).
   Never push, never tag, never merge.

### Shared Context (paste at the top of every session)

```text
Repo: Kloppy — retro local-first Electron desktop assistant + static site.
Branch: release/v0.1.0 (confirm; tree must be clean). App: kloppy-desktop/.
Site: single inline index.html at repo root — no external JS/CSS/fonts/analytics.
Remote: https://github.com/ImZackAdams/Kloppy-.git (trailing hyphen is real).
Commands (from kloppy-desktop/):
  npm test | npm run check
  env -u ELECTRON_RUN_AS_NODE npm start      # VSCode sets that var; it breaks Electron
  KLOPPY_USER_DATA_DIR="$(mktemp -d)" ...    # throwaway profile
Invariants: contextIsolation on, nodeIntegration off, renderer talks to main
only via window.kloppy; state/validation in main; data in Electron userData;
only network request ever = opt-in, pinned, SHA-256-verified model download.
Out of scope: signing/notarization, action execution, rich reminder parsing,
import/export, auto-update.
Git: suggest a commit message; commit ONLY if told. Never push/tag/merge.
```

## Prompt Execution Order

1. Audit and app hardening — Strong — app code, verify-then-fix
2. Packaging verification, CI, and release workflows — Strong — build + `.github/`
3. Landing page downloads section — Strong — `index.html`
4. Docs and release collateral — Cheaper — READMEs, LICENSE, notes, runbook
5. Final QA and go/no-go — Cheaper (Strong only if fixes needed) — packaged build

---

## Prompt 1: Audit and App Hardening

Model recommendation: Strong coding model

Objective:
Verify the app's advertised MVP behavior end-to-end and fix only proven
defects across UI polish, core features, failure paths, and settings.

Context to inspect:
`kloppy-desktop/README.md` smoke-test checklist (~lines 128–140);
`src/settings.js` (139 lines, read fully); grep-navigate `src/main.js`,
`src/renderer/app.js`, `src/llm.js`, `src/model-setup.js`, `src/storage.js`.

Instructions:
1. Confirm branch/clean tree; run `npm test` and `npm run check` (baseline:
   51 pass).
2. On a temp profile, walk the README smoke checklist: single-instance guard,
   SETUP.EXE gates the model download, cancel deletes the partial file, custom
   model path flips chat to ready, note + reminder persist across relaunch, due
   reminder fires in-app alert AND OS notification, launch-minimized starts
   hidden with tray, close hides to tray.
3. Walk every panel (chat, notes, reminders, watcher, actions, settings, About,
   summon popup) in both themes and two personality modes: no clipped layouts,
   empty states read as intentional Kloppy voice.
4. Exercise failure paths: chat with no model configured and with a bogus
   `modelPath`; delete a watched folder while watching; truncate one userData
   JSON and relaunch (must recover via `storage.js`). Raw errors reaching the
   UI are defects.
5. Settings: confirm each key in DEFAULTS (`launchMinimized`, `theme`
   `light|dark`, `personalityMode`, commentary + frequency, model path, user
   name) validates, round-trips, and has a matching UI control. Fix the stale
   comment at `src/settings.js:12` (launch-minimized IS wired, `main.js:436`).
6. Fix only what failed, smallest diff, in the owning module; extend the
   matching existing `test/*.test.js` where a fix is testable without Electron.
   Note (don't fix) README inaccuracies — pass them to Prompt 4.

Do not:
Add features or settings, rename keys, change IPC shapes or the preload API,
improve reminder parsing, wire up actions, touch packaging or `index.html`.

Validation:
`npm test` + `npm run check` pass; re-run each failed item after its fix.

Deliverables:
Results table (item → pass/fail → fixed) + doc-mismatch notes for Prompt 4.
Suggested commit (only if asked): `fix(desktop): v0.1.0 hardening pass`.

---

## Prompt 2: Packaging Verification, CI, and Release Workflows

Model recommendation: Strong coding model

Objective:
Prove the landed packaging config works, then add CI and a tag-triggered
three-OS release workflow with checksums and a draft GitHub Release.

Context to inspect:
`kloppy-desktop/electron-builder.config.js` (read — it is fully commented),
`package.json` scripts (`dist:mac` already sets
`CSC_IDENTITY_AUTO_DISCOVERY=false`), root `README.md` Deployment section.

Instructions:
1. `npm run dist:linux`; confirm `Kloppy-0.1.0-linux-x86_64.AppImage` and
   `Kloppy-0.1.0-linux-amd64.deb`; confirm via
   `npx asar list release/linux-unpacked/resources/app.asar` that `test/`,
   `models/`, `llamafile-runtime/`, `*.download` are excluded; run the AppImage
   on a temp profile (first-run setup appears, mascot icon, second launch
   focuses the first). Change packaging config ONLY if a check fails.
2. Create `.github/workflows/ci.yml`: push + PR to `main` and `release/v0.1.0`;
   ubuntu-latest; working-directory `kloppy-desktop`; setup-node LTS with npm
   cache; `npm ci`, `npm test`, `npm run check`. Pin action versions.
3. Create `.github/workflows/release.yml`: on tag `v*`; matrix ubuntu/macos/
   windows-latest; each leg `npm ci`, `npm test`, `npm run check`, then its
   `dist:*`; generate `SHA256SUMS-<os>.txt`; upload installers + checksums to
   ONE draft GitHub Release. Upload only AppImage/deb/dmg/NSIS exe (skip zips).
   No signing secrets; leave commented TODOs where signing goes.
4. Update root README Deployment → Desktop App: tag → matrix build → draft
   release with checksums → human smoke-tests → human publishes.

Do not:
Push, tag, or add signing. Touch app code. Use unpinned actions. Attempt
mac/win builds locally (CI owns those).

Validation:
`actionlint` if available, else two careful YAML review passes; artifact globs
cross-checked against the real filenames from step 1; state that first live
verification happens on the first tag push.

Deliverables:
Two workflow files, README update, exact artifact filename list (needed by
Prompt 3). Suggested commit (only if asked):
`ci: packaging verification and tag-triggered release workflows`.

---

## Prompt 3: Landing Page Downloads Section

Model recommendation: Strong coding model

Objective:
Make `index.html` the distribution channel: a downloads section fed by a
placeholder config, unsigned-install FAQ entries, graceful until real URLs exist.

Context to inspect:
Root `index.html` only (1,607 lines — grep-navigate). Sections: `#fall`,
`#receipt`, `#earn`, `#roadmap`, `#testimonials`, `#pricing`, `#excuses` (FAQ
`<details>`), `#goodbye`; `STORE` config ~line 1485; "Download details after
checkout" copy ~line 1570. Install-steps source: `kloppy-desktop/README.md`
"Installing unsigned builds".

Instructions:
1. Next to `STORE`, add `DOWNLOADS`: `version: '0.1.0'`; platforms windows
   (`.exe`), macos (`.dmg`), linuxAppImage (`.AppImage`), linuxDeb (`.deb`),
   each `{ label, fileType, url: '', sha256: '' }`. Comment the URL shape:
   `https://github.com/ImZackAdams/Kloppy-/releases/download/v0.1.0/Kloppy-0.1.0-<os>-<arch>.<ext>`
   (exact Linux names from Prompt 2).
2. Add `<section id="download">` styled like the existing retro `win` cards:
   per-platform card with version, file type, truncated checksum + copy-full
   affordance. Empty `url` ⇒ Kloppy-voiced not-ready text ("still in the box"),
   never a dead link. Must degrade with JS disabled. Add a nav link. Use
   `navigator` only to highlight the likely platform card — nothing sent
   anywhere.
3. Add unsigned-install steps as `<details>` in the `#excuses` FAQ style:
   macOS right-click→Open + `xattr -cr /Applications/Kloppy.app` fallback;
   Windows SmartScreen More info→Run anyway; Linux `chmod +x`. Keep facts
   intact; Kloppy voice welcome. Link the GitHub Releases page for older
   versions.
4. Rewrite the "Download details after checkout" copy: downloads are free;
   $4.20 is voluntary support. HTML comment: a static page cannot enforce a
   paywall.
5. Root README launch checklist: add "Fill DOWNLOADS config after publishing
   the release".

Do not:
Add any external request, JS/CSS/font, or analytics. Split the file. Change the
Stripe flow or newsletter form beyond the copy fix. Break existing sections.

Validation:
Open in a browser: renders in both site themes, platform highlight works, no
dead links, no console errors, works with JS disabled.

Deliverables:
Updated `index.html` + README checklist line. Suggested commit (only if asked):
`feat(site): downloads section as distribution channel`.

---

## Prompt 4: Docs and Release Collateral

Model recommendation: Cheaper verification model

Objective:
Sync both READMEs with shipped behavior; add `LICENSE`, release notes, and the
human release runbook.

Context to inspect:
Root `README.md`, `kloppy-desktop/README.md` (Features + the "Release-note
privacy disclosure" paragraph), doc-mismatch notes from Prompt 1,
`git log -3 --format='%an <%ae>'`, the Prompt 2 workflows and Prompt 3
`DOWNLOADS` shape.

Instructions:
1. Root README: fix the "Not done yet" line (OS notifications and
   launch-minimized ARE done; installers now built by the tag workflow).
   Desktop README: replace "(midnight / beige / toxic green)" with the real
   `light | dark` themes + personality modes; apply Prompt 1's other notes.
   Surgical rewording only.
2. Add root `LICENSE`: standard MIT, copyright 2026, owner from git author
   identity — do not invent a legal entity.
3. Add `kloppy-desktop/RELEASE_NOTES.md`, `v0.1.0` section: 2–3 Kloppy-voiced
   sentences; factual feature list from the README; the privacy-disclosure
   paragraph copied VERBATIM; known limitations (unsigned → OS warnings, simple
   reminder parsing, inert actions, no auto-update). Short — the site reuses it.
4. Add `RELEASE.md` runbook, numbered: clean tree → tests pass → human pushes
   branch → human tags `v0.1.0` → watch release.yml → download artifacts +
   `SHA256SUMS-*.txt` → smoke-test Linux locally, mac/win on real hardware →
   publish draft release → fill `DOWNLOADS` with final URLs + checksums →
   merge to `main` for Pages → verify live links. Plus human-only tasks:
   enable Pages, getkloppy.com DNS, swap test Stripe link for live in
   `STORE.stripePaymentLink`, set `STORE.newsletter`, set up
   hello@getkloppy.com.
5. `grep -rn "0\.0\.1" --include="*.md" .` (skip node_modules) — fix stragglers.

Do not:
Touch app code or `index.html` markup. Rewrite the privacy disclosure. Tag or
push. Invent steps not backed by the actual workflows/config.

Validation:
Greps for "midnight", "toxic green", "wired up in a future version" return
nothing; runbook references only files/workflows that exist; LICENSE matches
package.json's MIT.

Deliverables:
Updated READMEs, `LICENSE`, `kloppy-desktop/RELEASE_NOTES.md`, `RELEASE.md`.
Suggested commit (only if asked):
`docs: sync docs and add LICENSE, release notes, runbook`.

---

## Prompt 5: Final QA and Go/No-Go

Model recommendation: Cheaper verification model (switch to Strong only if a
fix is required)

Objective:
One QA pass on the packaged Linux build plus a mechanical repo sweep; emit
GO or NO-GO. No edits expected.

Context to inspect:
The Final Release Checklist below; `kloppy-desktop/README.md` smoke checklist;
rebuild `npm run dist:linux` if `kloppy-desktop/release/` is stale.

Instructions:
1. Run the AppImage on a fresh temp profile; walk the full smoke checklist plus
   About shows v0.1.0, mascot icon, both themes, chat setup flow. Record a
   PASS/FAIL table. Fix only trivial blockers (≲10-line diffs); anything bigger
   → STOP and report with a proposed fix.
2. Confirm existence: `LICENSE`, `RELEASE.md`, `kloppy-desktop/RELEASE_NOTES.md`,
   `.github/workflows/ci.yml` + `release.yml`, `DOWNLOADS` config and
   `id="download"` in `index.html`.
3. Grep sweep (should be clean): `0\.0\.1`; "Download details after checkout";
   "midnight|toxic green"; "wired up in a future version". The signing TODOs in
   `electron-builder.config.js` and the safety TODO in `src/actions.js` are
   intentional keepers.
4. Confirm `npm test` + `npm run check` pass, tree clean, `git tag` shows no
   `v0.1.0`, nothing pushed.
5. Mark every line of the Final Release Checklist and emit GO or NO-GO with
   reasons; route open items to the responsible prompt number.

Do not:
Fix non-blockers. Push, tag, or publish. QA mac/win here (CI + the RELEASE.md
runbook cover those).

Validation:
The emitted checklist itself, every line marked.

Deliverables:
QA table + GO/NO-GO verdict. Suggested commit only if a trivial fix landed:
`fix(desktop): final QA blockers`.

---

## Final Release Checklist

Functionality & UX
- [ ] Tests + `npm run check` pass on `release/v0.1.0`; smoke checklist passes
      on the packaged AppImage (fresh profile)
- [ ] Single-instance, tray hide, launch-minimized, in-app + OS reminder
      notifications, gated model download with cancel-cleanup all verified
- [ ] Both themes and personality modes render cleanly; empty/failure states
      are Kloppy-voiced, never raw errors; About shows v0.1.0; mascot icon
      everywhere

Packaging & CI
- [ ] Artifacts named `Kloppy-0.1.0-<os>-<arch>.<ext>`; asar excludes `test/`,
      `models/`, `llamafile-runtime/`, `*.download`
- [ ] ci.yml green on the release branch; release.yml reviewed (first live run
      is the tag push); macOS ad-hoc sign hook intact; Windows NSIS per-user

Docs & site
- [ ] READMEs factually match shipped behavior; LICENSE, RELEASE_NOTES.md,
      RELEASE.md exist
- [ ] Downloads section live with placeholder-safe cards, unsigned-install FAQ,
      GitHub Releases link, voluntary-$4.20 copy; launch checklist includes
      filling DOWNLOADS after publishing

Post-tag (human, per RELEASE.md)
- [ ] Draft release has 4 installers + SHA256SUMS files; mac/win smoke-tested
      on real hardware via documented unsigned-open steps
- [ ] DOWNLOADS filled with final URLs + checksums; live links resolve and
      checksums match

Known limitations (state in release notes; don't fix for v0.1.0)
- [ ] Unsigned builds → OS warnings (documented); simple reminder parsing;
      inert actions; no auto-update; no import/export

Rollback
- [ ] Draft release is the gate — nothing public until a human publishes
- [ ] Site rollback = revert the DOWNLOADS-fill commit on `main`; app rollback
      = mark the release pre-release/draft and remove links; don't delete
      public tags — fix forward with v0.1.1
