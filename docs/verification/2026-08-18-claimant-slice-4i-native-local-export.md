# Claimant Slice 4I — native local export contract

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-native-local-export`

Starting checkpoint: `6077d66` (`Add claimant retrieval suspension and expiry`)

## Outcome

Slice 4I adds a hard-disabled, runtime-disconnected mobile coordinator and production-shaped native adapter contract for optional claimant-controlled local export.

- Export requires the exact completed local-open authority: served package, completed retrieval, active retrieval access, current finalized package, no prior export, no closure, exact case/completion/delivery/package/session identifiers, and the opaque native open-session reference.
- The request must carry the exact `claimant_explicit_local_copy` intent, a unique interaction ID, and a fresh timestamp. Requests older than two minutes, materially future-dated, after package expiry, before completion, suspended, expired, already exported, or closed fail before native work.
- The native-shaped operation receives only identifiers, timestamps, asset count, and the opaque local-open reference. It must independently require explicit confirmation and fresh device-owner presence.
- Native success must cross-bind every identifier and the exact open session, interaction and asset count. Authentication and export must occur within the bounded two-minute window and before package expiry.
- JavaScript receives only a value-free receipt: identifiers, asset count, generic `user_selected_local_copy` destination class, opaque export receipt reference, export time, and fixed safety booleans.
- Strict parsing rejects any extra field, including plaintext, bytes, filenames, paths or URLs. `plaintext_returned_to_javascript`, `server_upload_performed` and `closure_recorded` are fixed false.
- Work is single-flight and cancellation-safe. All failures reduce to one generic error family without native detail leakage.

No screen, route, app entrypoint, network call, browser/server plaintext, persistence, database or Supabase change, production Swift/Kotlin method, Expo native-module binding, filesystem/sharing dependency, hosted change, deployment, real data, closure, or external behavior was added.

## Verification

- New mobile tests: 9 passed, covering immutable-false defaults, absent native binding, exact mapping, safe receipt output, active/completed/unexported authority, intent and timing, native confirmation/user presence, cross-object substitutions, unsafe extra fields, stale authentication/export, serialization, cancellation and error reduction.
- New static contract/isolation checks: 7 passed. They prove both approvals remain literal false, normal mobile runtime has no import, direct native/filesystem/sharing/network/storage dependencies are absent, no production Swift/Kotlin export method exists, and only a value-free receipt can return.
- Workspace tests: 1,092 passed; 3 established environment-gated mobile tests skipped.
- One initial resource-saturated mobile run timed out in an unrelated existing emergency-grant test while Vitest reported a stuck crypto worker. That test immediately passed 4/4 alone, and a clean full mobile rerun passed 484 tests with the 3 established skips.
- Full static/security regressions: 203 passed serially.
- All workspace typechecks, zero-warning lint, production web build, API bundle check, claimant custody isolation, native-local-export isolation and `git diff --check` passed.

## Remaining gates

Both Slice 4I approvals remain immutable false. There is no native implementation or binding, no user-facing confirmation flow, no actual device authentication, no exported file, and no native custody evidence. The contract does not persist an export receipt to the server and does not authorize closure.

Delivery, native open, retrieval completion, suspension/expiry, optional local export, claimant confirmation and closure remain separate facts. An exported local copy cannot be remotely recalled or proven deleted.

The next bounded slice is Phase 4 Slice 4J: an immutable-false, unmounted retrieval-lifecycle closure foundation. It must require exact completed authority and any separately verified export fact, preserve every historical served/opened/export state, and record only administrative lifecycle closure—never local deletion or recall.
