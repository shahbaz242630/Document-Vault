# Claimant Slice 6E emergency sheet and first claimant screen verification

Date: 2026-09-25 (Asia/Dubai)

## Result

Slice 6E passes local verification on `claude/claimant-slice-6e-offline-code-screens`, stacked on Slice 6D (PR #93, head `0bfa874`).

## Delivered

- **`packages/shared-types/src/claim/offline-code/sheet.ts`: a strict `SKQ2.` emergency-sheet codec.** It uses a canonical-JSON, base64url payload containing the locator, the client secret, the KDF profile and the record binding.
  - Each component is checked by its existing validator, and the KDF profile must match the binding.
  - It rejects other prefixes, whitespace, padding, truncation, oversize input, non-canonical JSON and invalid UTF-8, all with one generic error.
  - The locator commitment is still verified cryptographically by the existing proof core before any proof is sent.
- **`claim-flow.ts`: a state machine over a narrow handle.** Its states are unavailable, ready, checking, claim started, sheet not recognised, could not start, and closed.
  - Fresh idempotency keys are created for each attempt.
  - The sheet and secret are never held in state or snapshots.
  - Failures are generic, and there is no automatic retry.
- **The 6A bootstrap gains `claimFlowRuntime()`.** It returns null for the inert mount and after closure, and it rejects operations once the bootstrap closes. The 6A isolation check now requires both null paths.
- **The `app/claim/offline-code` route with its panel and view-model.** The root layout provides the handle through `ClaimFlowHandleContext`, using a small lifecycle hook with no setState in effects. The normal app always shows "Claiming with an emergency sheet isn't available yet."

## Local evidence

- Sheet codec: 19 tests. Claim flow against the real bootstrap → 5Z chain (happy path, unrecognised sheet, generic failure without retry, kill switch and background during native signing, disposal): all pass. View-model tests pass.
- Workspace tests: 1,591 passed with the three established skips. Serial script tests: 294 passed.
- Typechecks and zero-warning lint pass. The Phase 1 guard, including the function-length limit, passes.
- Security, GitHub Actions security, mobile-secret and production-dependency checks pass, and all 42 claimant isolation checks pass.
- Expo Doctor 21/21; the Android export passes; the web build produces 24 routes.
- Not run locally: the API Vercel bundle check (covered by CI).

No launch-policy control, approval constant, server route, migration or hosted state changed. The screen has no navigation entry and never offers claims in the normal app.
