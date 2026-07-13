# Kloppy v0.1.0 Launch Notes

## Positioning

Kloppy is a local first desktop gremlin for notes, reminders, AI chat, and folder
commentary. The application is free. It requires no account, telemetry, cloud
subscription, or contribution.

## Release

- Version: `0.1.0`
- Published: July 12, 2026
- Release: <https://github.com/ImZackAdams/Kloppy/releases/tag/v0.1.0>
- Status: public, not a draft, not a prerelease
- Signing: unsigned on every published platform; macOS is not notarized

### Verified artifacts

| Platform | Published artifact | SHA-256 |
| --- | --- | --- |
| Windows x64 | `Kloppy-0.1.0-win-x64.exe` | `16d44d8de0866498c908f5da842b1535f2a58a985a667197a569e5ab165d773a` |
| macOS Intel + Apple Silicon | `Kloppy-0.1.0-mac-universal.dmg` | `1574ed9416520d2623b32852fafe95401754c55dbbb39301e50e1c5d78d635b9` |
| Linux x86_64 | `Kloppy-0.1.0-linux-x86_64.AppImage` | `5f9ad00999ed5d02e62ffe39a28c4194dad156d1d085c6784299d0b61197e9b0` |
| Debian-family Linux amd64 | `Kloppy-0.1.0-linux-amd64.deb` | `2ce4cc3f4221b91458f33a2f814939ec00434334842e00ed14ad9793a77e8a1b` |

The website derives artifact URLs from one centralized GitHub release URL.
Unavailable platforms are not linked. There are no published Windows ARM,
Linux ARM, Android, iOS, or browser application artifacts. The project does not
advertise minimum operating-system versions that it has not tested and declared.

## Launch flow

The homepage order is hero, downloads, product demonstration, explanation,
features, lore, Certificate of Forgiveness, optional contribution, and FAQ. The
primary CTA reaches downloads without requiring visitors to read the comeback
story or payment pitch.

The optional contribution is a one-time $4.20 Stripe Payment Link. It unlocks
nothing and is not a purchase. All contribution CTAs use the same centralized
link and open the Stripe-hosted checkout only after an explicit click. The live
checkout was reviewed without completing payment: it identifies the product as
`Kloppy Fund`, shows a total due of $4.20, and requests email, payment, and any
address information Stripe needs to calculate tax.

## Privacy and analytics

- The website has no account, cookie banner, analytics script, advertising
  pixel, or invasive tracking.
- GitHub receives a normal request only when a visitor opens the release page or
  downloads an artifact.
- Stripe receives a normal request, plus fixed campaign labels, only when a
  visitor chooses an optional contribution CTA. Its hosted form then handles the
  contact, payment, and tax information it displays.
- The Certificate of Forgiveness sanitizes and renders the entered name in the
  browser. It does not send the name to Kloppy, GitHub, Stripe, or another
  server. Sharing and downloading always require a user action.
- In the desktop app, notes, reminders, settings, watched-folder metadata, and
  chat data stay on the machine. The optional checksum-verified model download
  is the only external app request and starts only after user approval; chat then
  binds to `127.0.0.1`.

## Historical commit claim

The original Kloppy v0.1.0 application-and-launch state was completed at exactly
69 repository commits on `main`. Later website commits improved launch messaging
and distribution, so 69 is a historical release milestone rather than a
permanent repository total. See [`CHANGELOG.md`](CHANGELOG.md) for the precise
tag and commit context.

## Known limitations

- v0.1.0 is unsigned and macOS is not notarized. Visitors must follow the
  platform-specific warning instructions and may verify the published checksums.
- CI builds artifacts, but final installer launch testing still requires matching
  Windows, macOS, and Linux hardware.
- No minimum operating-system versions have been formally declared.
- There are no ARM packages for Windows or Linux.
- The Certificate share path depends on Web Share support; otherwise it copies
  the prepared post to the clipboard.
- The static site cannot determine whether an external service later changes or
  becomes unavailable, so release and payment links must be checked after deploy.
