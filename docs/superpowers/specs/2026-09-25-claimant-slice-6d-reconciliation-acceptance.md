# Slice 6D — claimant mobile-to-API reconciliation acceptance

Selected and owner-approved on 2026-09-25 after Slice 6C merged through PR #92 at `404945a`. Slice 6D is the second Phase 6 production-hardening slice. It covers the Phase 6 reconciliation, replay and rollback items across the mobile and API boundary.

## Gap

Slice 6C proved that the mobile runtime chain fails closed when interrupted, but it used synthetic HTTP responses. The earlier integration tests from Slices 5K and 5N connect real mobile code to the real Hono routes, but only one component at a time: the offline-code coordinator or the handoff coordinator. No test runs the complete runtime (6A bootstrap → 5Z foundation → 5T portal-session client, 5R/5S bridge and handoff) against the real server routes. None checks what the server has actually recorded when a response is lost, an exact retry is made, the kill switch interrupts recovery, or the app restarts and loses its memory-only state.

## Scope

Add one test-only acceptance suite under `services/api/src/claimant/`, following the existing `*-mobile-integration.test.ts` pattern. The suite constructs the real mobile runtime through the 6A synthetic construction seam. Its injected `send` transports dispatch into the actual mounted Hono routes for:

- portal session activate, assert and revoke,
- offline-code V2 challenge and proof,
- authenticated handoff issue and complete.

Only the database RPC layer is replaced. It is a stateful in-memory synthetic store implementing exactly the idempotency, replay, displacement and single-use rules defined in these migrations:

- `20260804210000_claimant_portal_session_boundary.sql`
- `20260819084008_offline_code_v2_enumeration_resistant_challenges.sql`
- `20260903075258_claimant_offline_code_v2_authenticated_handoff.sql`

Each rule the store models is cited in a comment next to its implementation. A mismatch between the store and the SQL counts as a defect in the store. Identity and Ed25519 verification use the same synthetic, test-only seams as the existing integration tests.

### Scenarios

1. **Lost committed response, then exact retry**, for each mutating step: portal activation, proof submission, handoff completion and portal revoke. The server commits, the response is lost, and the runtime's exact retry must:
   - receive the server's replayed result,
   - leave exactly one server record (one session, one proof fact, one case, one revocation),
   - produce no second native signature or proof,
   - still yield the value-free draft or closed state.
2. **Lost response, then kill switch or background.** Retry authority on the device is dropped, while the server keeps what it committed. The suite asserts that server state stays consistent and that no later call is sent.
3. **Restart after an ambiguous commit.** A new bootstrap and runtime instance starts with fresh idempotency keys and none of the old memory. The suite asserts the outcomes the SQL defines, for example:
   - a new portal activation displaces the stale session, and the stale session can no longer assert;
   - a consumed handoff cannot be completed again under a new key, and no second case is created;
   - the client fails closed with the generic error wherever the server refuses to resume.
4. **Changed input under an existing key** (a key reused for a different request) is rejected by the server path and never treated as a replay.
5. **Retry after the kill switch** across the whole chain, including every entry point, sends nothing to the API.

For every scenario the suite checks the device's value-free snapshots and the server store's record counts, so the device and the server agree on what happened.

## Production code

No production code change is planned. If the suite exposes a defect, the fix is the smallest change in the affected existing boundary. It is recorded in the verification file and adds no operation, input, importer, route or authority. All approval constants stay literal false, the 6B launch policy stays false/false/engaged, and routes stay concealed while disabled.

## Findings and fixes

The suite found two defects. Both are fixed with the smallest change in the existing boundary, and each has a regression test that fails without the fix.

1. **Portal revoke never succeeded against the real server contract.** `claimant_revoke_portal_session` advances the session control row's version exactly once and returns the new version; replays return the same stored value. The Slice 5T mobile client required the revoke result to equal the *active* version, so every revoke against the real database, not only retries, was reported as a failure on the device even though the server had revoked the session. The earlier unit tests used made-up responses that encoded the wrong contract. The client (`apps/mobile/src/features/claimant-session/portal-session-client.ts`) now requires exactly the advanced version in both the revoke and retry-revoke paths; assertion keeps exact equality. The four earlier test fixtures now return the server's real revoke version.
2. **The kill switch left a one-microtask window.** The 6A bootstrap cancelled the runtime synchronously but deferred `dispose()` to the next microtask, so an operation started immediately after `engageKillSwitch()` still reached the API (the suite observed a portal activation succeeding). `closeRuntime` in `apps/mobile/src/features/claimant-journey/runtime-bootstrap.ts` now disposes synchronously and still fails closed on any disposal error. No bootstrap operation is exposed today, so this was not reachable from the app, but the kill switch must be immediate before any journey operation is exposed.

## Isolation

The suite is test-only. Cross-workspace imports from the API test into mobile modules follow the existing 5K and 5N integration tests. All claimant isolation checks must pass unchanged. No runtime importer is added and no route or controller configuration changes.

## Verification

- Focused 6D suite, plus the existing 5K/5N integration, portal-session route and 6C tests.
- Workspace tests, typechecks, zero-warning lint.
- Security, audit and all claimant isolation checks; serial script tests.
- Expo Doctor, API bundle (in CI) and web production build.
- CI on the pull request, watched from its current head; merged only after green and owner approval.

## Limits and non-goals

This is contract-level evidence against a store modelled on the SQL, not the database itself. Real PostgreSQL row locking, RLS and concurrent-transaction behavior need the local Supabase stack and remain a separate later slice, run where Docker is available. Also out of scope: persistence of claimant state across restarts, UI or navigation, hosted Auth/MFA or hosted mutation, production native signing or custody, provider adapters, migrations or schema changes, deployment, real data, activation and any automatic next slice.
