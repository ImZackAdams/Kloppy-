// electron-builder configuration for Kloppy.
//
// This lives in its own file (rather than package.json's "build" field) so it
// can carry comments — specifically the macOS ad-hoc signing hook below and the
// commented-out TODO blocks for real Developer ID / Authenticode signing. The
// file name is auto-discovered by electron-builder; see the dist:* scripts in
// package.json.
//
// v0.1.0 ships UNSIGNED and un-notarized on all three OSes. Everything here is
// tuned to make that deterministic and CI-safe. See "Installing unsigned
// builds" in README.md for what users have to do to open these.

const { execFileSync } = require("node:child_process");

module.exports = {
  appId: "com.kloppy.desktop",
  productName: "Kloppy",
  // Keep the version in the artifact name via ${version}; never hardcode it.
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  asar: true,
  npmRebuild: false,
  directories: {
    output: "release",
  },

  // The downloaded llamafile, partial downloads, and the llamafile runtime cache
  // live under Electron userData and must NEVER be bundled into the package.
  // These exclusions are load-bearing — verified by inspecting the built asar,
  // not just trusted from here.
  files: [
    "src/**/*",
    "package.json",
    "!test/**/*",
    "!release/**/*",
    "!dist/**/*",
    "!out/**/*",
    "!models/**/*",
    "!llamafile-runtime/**/*",
    "!**/*.download",
  ],

  // ---------------------------------------------------------------------------
  // Linux: AppImage + deb.
  // ---------------------------------------------------------------------------
  linux: {
    target: ["AppImage", "deb"],
    // The generated .desktop entry derives its fields from here (verified by
    // extracting the built deb + running desktop-file-validate):
    //   Name       <- productName ("Kloppy")
    //   Categories <- this `category` ("Utility;")
    //   Comment    <- this `description`
    // Setting desktop.Comment/desktop.Categories directly does NOT work in
    // electron-builder 24.13.3 (they're overwritten by description/category),
    // so we drive them here. `desktop` below is only for the extra Keywords key.
    category: "Utility",
    synopsis: "A retro desktop gremlin assistant",
    description:
      "A local-first retro desktop assistant: notes, reminders, opt-in folder " +
      "watching, and local-only AI chat. He means well. Probably.",
    desktop: {
      Keywords: "assistant;notes;reminders;gremlin;kloppy;",
    },
  },

  // deb wants a real maintainer + synopsis or lintian complains.
  deb: {
    maintainer: "Kloppy <hello@getkloppy.com>",
    synopsis: "A retro desktop gremlin assistant",
  },

  // ---------------------------------------------------------------------------
  // macOS: one universal dmg (+ zip) covering Intel and Apple Silicon.
  // ---------------------------------------------------------------------------
  mac: {
    category: "public.app-category.productivity",
    // A single universal artifact instead of separate x64/arm64 builds. Kloppy
    // is pure JS with no native modules (npmRebuild:false), so the universal
    // lipo-merge configures and builds cleanly.
    target: [
      { target: "dmg", arch: "universal" },
      { target: "zip", arch: "universal" },
    ],

    // --- Unsigned, but ad-hoc signed so Apple Silicon will launch it ---
    //
    // We have no Developer ID certificate yet. Two facts, verified against
    // app-builder-lib 24.13.3's own source (not assumed from memory):
    //   1. Setting `identity: null` makes electron-builder log "skipped macOS
    //      code signing" and sign NOTHING — not even ad-hoc. So we do NOT set
    //      it; that would leave arm64 unlaunchable.
    //   2. In the no-certificate path electron-builder also skips signing, and
    //      @electron/osx-sign requires a real identity — neither ad-hoc signs.
    //
    // Apple Silicon refuses to launch an app with a missing/broken signature,
    // and electron-builder's repackaging (executable rename, asar injection,
    // universal lipo-merge) invalidates the ad-hoc signature Electron ships
    // with. So we re-apply an ad-hoc signature to the FINAL bundle here. A
    // custom `sign` hook is invoked even when no certificate is present and runs
    // on the post-merge .app — the correct injection point for a universal
    // build. Pair with CSC_IDENTITY_AUTO_DISCOVERY=false (set in the dist:mac
    // script) so the build never hunts for or fails on a missing certificate.
    sign: async (configuration) => {
      const appPath = configuration.app || configuration.path;
      // `--deep --force` re-seals nested helpers/frameworks inside-out; ad-hoc
      // ("-") needs no keychain, so it is safe in CI with no certificates.
      execFileSync(
        "codesign",
        ["--sign", "-", "--force", "--deep", "--timestamp=none", appPath],
        { stdio: "inherit" }
      );
    },

    // ========================= TODO: Developer ID + notarization =============
    // Enable ONLY once we own an Apple Developer ID Application certificate.
    // Then, to ship a properly signed + notarized build:
    //   - DELETE the ad-hoc `sign` hook above so @electron/osx-sign runs the
    //     real signing path (a custom `sign` hook fully replaces it),
    //   - DROP CSC_IDENTITY_AUTO_DISCOVERY=false from the dist:mac script,
    //   - supply the cert via CSC_LINK / CSC_KEY_PASSWORD env (or `identity`),
    //   - notarize with an app-specific password or App Store Connect API key.
    //
    // identity: "Developer ID Application: <NAME> (<TEAMID>)",
    // hardenedRuntime: true,
    // gatekeeperAssess: false,
    // entitlements: "build/entitlements.mac.plist",
    // entitlementsInherit: "build/entitlements.mac.plist",
    // notarize: { teamId: "<TEAMID>" }, // env: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD
    // =========================================================================
  },

  // ---------------------------------------------------------------------------
  // Windows: NSIS installer + zip.
  // ---------------------------------------------------------------------------
  win: {
    target: ["nsis", "zip"],

    // ========================= TODO: Authenticode signing ====================
    // Enable once we own a Windows code-signing certificate (OV, or EV to avoid
    // SmartScreen reputation build-up). Then set:
    // certificateFile: process.env.WIN_CSC_LINK,
    // certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
    // signingHashAlgorithms: ["sha256"],
    // rfc3161TimeStampServer: "http://timestamp.digicert.com",
    // =========================================================================
  },

  nsis: {
    oneClick: false, // show a real installer wizard, not a silent one-click
    perMachine: false, // per-user install by default (no admin elevation needed)
    allowElevation: true, // ...but let the user elevate to all-users if they want
    allowToChangeInstallationDirectory: true, // let the user pick the folder
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Kloppy",
    uninstallDisplayName: "Kloppy",
  },
};
