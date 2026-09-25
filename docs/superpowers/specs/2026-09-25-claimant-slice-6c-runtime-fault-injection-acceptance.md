# Slice 6C — claimant runtime fault-injection and kill-switch acceptance

Selected and owner-approved on 2026-09-25 after Slice 6B merged through PR #90 at `9012a75`. Slice 6C is the first Phase 6 production-hardening acceptance slice. It covers the Phase 6 outage, race/replay and rollback items for the mobile claimant runtime chain that already exists.

## Gap

Each layer has isolated tests: the 6A bootstrap (mostly against a stub runtime factory), the 5Z runtime foundation, the 5U–5V session journey and the 5W acceptance harness. No test drives the real chain — 6A bootstrap → 5Z foundation → 5X hosted-identity boundary, 5Y native-signing boundary and 5U–5V journey → 5T portal-session client and 5S/5R bridge — and then interrupts it while an operation is in flight. The kill switch is the rollback control for the whole runtime, so its behavior across every in-flight stage must be proven on the composed chain, not only on each part.

## Scope

Add one test-only acceptance suite, `apps/mobile/src/features/claimant-journey/runtime-fault-injection-acceptance.test.ts`. It constructs the real 6A bootstrap through its existing explicit synthetic construction seam (approved, enabled, kill switch disengaged, `syntheticOnly: true`, `productionRuntime: false`). It passes a `createRuntime` that calls the real `createClaimantRuntimeFoundation` and retains the returned runtime for the test to drive. All identity, transport, native-signer and lifecycle inputs are the existing synthetic test doubles, held on deferred promises so each stage can be paused.

In-flight stages: portal activation, fresh portal assertion, offline-code V2 challenge, proof submission, handoff issue, native handoff signing, handoff completion and portal revoke.

Faults injected at each stage:

- Kill-switch engagement through the bootstrap.
- Application `background` and `inactive` state through the bootstrap.
- Bootstrap disposal.
- Transport outage: a rejected request, followed by the kill switch to prove that any retained retry is revoked.
- A request that never settles, followed by the kill switch.
- Hosted-identity drift (session, AAL or issuer/audience change) while the stage is pending.
- Late success delivered after each closing fault, followed by every retry and entry point.

Assertions for every stage × fault cell:

- The pending operation rejects with the generic unavailable error only; no adapter detail, identifier, token, challenge, digest or signature escapes.
- A late or duplicate success never produces a draft, never advances the journey and never reaches a downstream adapter.
- No transport, identity or signer method is called after closure.
- Bootstrap and runtime snapshots are frozen, report `closed`, and keep identity, relationship, intake, review and release authority literal false.
- Retry entry points (activation, proof, completion, revoke) reject after closure; no retained retry authority survives.
- Every provider and lifecycle subscription is cleaned up exactly once, no listener remains, and disposal is awaitable.

Races, run separately:

- Kill switch and completion success settling in the same microtask turn.
- Concurrent `dispose()` calls, and `background` during an in-progress disposal.
- Repeated kill-switch engagement and repeated lifecycle events after closure.
- A construction-time failure in any one boundary (identity, signing or journey) closes the bootstrap, releases every subscription and makes no adapter call.

## Production code

No production code change is planned. If the suite exposes a defect, the fix is limited to the smallest change in the affected existing boundary. It must be recorded in the verification file and must not add an operation, input, importer or authority. All approval constants stay literal false and the 6B launch policy stays false/false/engaged. The normal application mount stays inert, and a dedicated test asserts that it still constructs nothing.

## Finding and fix

The never-settling cases exposed a defect in the Slice 5T portal-session client. Each activate, assert, revoke or retry request received an `AbortSignal` from a per-request controller, but `cancel()` and closure never aborted that controller. After a kill switch, background event or disposal, a request with no response kept running. Its operation never settled, and because `dispose()` awaits the active request, awaitable disposal could hang as well. Authority was not affected: the generation check already discarded any late result.

The fix in `apps/mobile/src/features/claimant-session/portal-session-client.ts` keeps the active controller, aborts it on `cancel()` and on closure, and makes dispatch stop waiting once the signal aborts, even if the injected transport ignores it. This matches the existing handoff transport. Because the generation changes first, an aborted request can never leave retry authority behind. A focused 5T regression test covers cancel and dispose. Without the fix, the three portal-session stages of the 6C never-settling test time out.

## Isolation

The suite is test-only and imports only the existing claimant-journey, claimant-session, claimant-handoff and claimant-offline-code modules, their test doubles, and test tooling. The existing 5X–5Z, 6A and 6B isolation checks must pass unchanged, and no guard is narrowed. No new normal-runtime importer is allowed.

## Verification

- Focused 6C suite plus the existing 6A, 6B, 5Z and 5W tests.
- Workspace tests, typechecks, zero-warning lint.
- Security, GitHub Actions security, Phase 1, mobile-secret, production-dependency and all claimant isolation checks; serial script tests.
- Expo Doctor and the web production build.
- CI on the pull request with an exact-head watcher. The API bundle and Vercel preview gates are covered in CI.

## Non-goals

Server, database, migration and RLS changes are out of scope. Server-side hostile, race and replay suites need the local Supabase stack and are a separate later slice. Also out of scope: claimant UI or navigation, environment or remote flags, hosted Auth/MFA, Supabase SDK use or hosted mutation, production native signer or custody, provider adapters, persistence, deployment or preview promotion, native/EAS builds, real claimant data, journey operation exposure through the bootstrap, intake/review/release authority, capability activation and any automatic next slice.
