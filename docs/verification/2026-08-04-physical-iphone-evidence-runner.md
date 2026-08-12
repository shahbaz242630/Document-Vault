# Physical iPhone Evidence Runner Evidence

Date: 2026-08-04 (Asia/Dubai)

## Scope

This value-free record covers the runtime-disconnected physical evidence coordinator described in `docs/superpowers/specs/2026-08-04-claimant-slice-1b-ios-secure-enclave-probe-harness.md`.

The increment prepared strict, privacy-safe evidence output without creating a route, screen, deep link, application import, production flag, native method, build, deployment, or external action. A later separately recorded increment now supplies an isolated internal probe app without changing the normal Sanduqkin router.

## Source And Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the existing local Phase 0-2 in-progress bundle.
- Implementation/test aggregate SHA-256: `9922f74765a5b853ab2d6d42bfb282dec316c5871444aefc956473c15ddd2a78`.
- Fingerprint algorithm: sort the three implementation/test paths ordinally, calculate SHA-256 over each complete file, serialize each as `<lowercase-sha256><two spaces><path>` joined by LF, then SHA-256 the UTF-8 serialization. Documentation is excluded to avoid a recursive hash.

## Enforced Boundary

- `CLAIMANT_PHYSICAL_EVIDENCE_APP_ENTRY_ENABLED` is a literal `false as const`.
- Only an exact iOS/non-production/probe-profile request with explicit operator, physical-device, passcode, and value-free confirmations reaches the native adapter.
- Added identifiers, relaxed confirmations, Android, production runtime, or another build profile fail before the adapter is called.
- Reports contain only generic result classes, timestamps, run ID, profile, platform, continuity/pass booleans, and the probe-only marker.
- Public keys/fingerprint values, device identifiers/names, proof material, nonce, salt, challenge, and native error details are absent.
- Native failures are redacted to `probe_error`; the underlying custody coordinator still attempts cleanup on every path.
- Normal mobile application code remains forbidden from importing the custody feature. The later executable host exists only under the separately selected `./probe-app` router and bundle identifier recorded in `2026-08-04-physical-iphone-custody-probe-build.md`.

## Verification

- Custody and physical-evidence tests: 11/11 passed across 2 files.
- Mobile: 420 tests passed and 3 existing tests skipped across 116 files.
- Mobile typecheck passed.
- Expo Doctor: 21/21 checks passed.
- Claimant custody isolation passed.
- Full repository lint, repository/GitHub Actions security, mobile secret, claim-vector reproducibility/isolation, and `git diff --check` passed.

## Closed Probe Gate And Remaining Production Gate

This runner is consumed by the separately isolated signed internal build recorded in `docs/verification/2026-08-04-physical-iphone-custody-probe-build.md`. The owner-reported authenticated pass, cancellation/cleanup, and authenticated retry matrix passed on a physical iPhone. Production runtime remains disabled; this disposable evidence does not approve the future production enrollment adapter, App Attest integration, or live invitation acceptance.
