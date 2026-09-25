# Claimant Slice 6G owner emergency-sheet registration route verification

Date: 2026-09-25 (Asia/Dubai)

## Result

Slice 6G passes local verification on `claude/busy-franklin-xv1jah`, based on `main` at `a6e15b5` (Slice 6F merged through PR #95). Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6g-owner-registration-route.md`, approved by the owner with revocation kept in this slice.

## Delivered

- **`offline-code-v2-owner-routes.ts`**, with two routes and one preflight handler.
  - `POST /owner/offline-code/v2/locators` registers a sheet.
  - `POST /owner/offline-code/v2/locators/:locatorRecordId/revoke` revokes one.
  - Both are gated by a literal-false approval constant and the `offlineCodeV2` capability.
  - They accept only an exact owner origin (`OFFLINE_CODE_V2_OWNER_ORIGIN`). It must differ from both the claimant origin and the API origin.
  - Each request needs a JSON content type, a 16 KiB body limit, a UUIDv4 `Idempotency-Key` and a bearer token. The route requires a fresh AAL2 owner session and asserts that it is still active.
  - The owner ID comes only from the session.
  - **Registration.** The body is strict, and any extra field is rejected, including the owner ID, the secret, the sheet payload and the vault key. The server:
    - normalises the printed locator;
    - requires canonical timestamps, `issuedAt` within 60 s of now and a validity of at most 365 days;
    - recomputes the locator commitment;
    - recomputes the record-binding digest with the session's user ID as `owner_id`.

    A sheet built for any other owner is rejected with 400, before any database call.
  - **Revocation.** It takes an empty `{}` body and always uses the reason `owner_revoked`.
  - **Responses.** Success returns only `locator_record_id`, `status` and `replayed`.
  - **Error mapping.**

    | Response | Cause |
    |---|---|
    | 400 | invalid request |
    | 401 | no token, bad token or inactive session |
    | 403 | fresh MFA needed |
    | 404 | disabled, wrong origin, or a record that isn't the owner's |
    | 409 | changed idempotent retry, duplicate or contention |
    | 413 | body too large |
    | 415 | wrong content type |
    | 503 | missing configuration or an outage |
- **`offline-code-v2-locator-index.ts`.** The single keyed boundary digest. The claimant challenge controller now imports it instead of keeping its own copy, so registration and lookup cannot drift apart.
- **Wiring.** Both routes are mounted in `services/api/src/index.ts`. With the default configuration, the mounted app returns 404 for both routes and both preflights.
- **`scripts/claimant-offline-code-v2-owner-routes-isolation-check.cjs`** and its test, wired into `package.json` and security CI. It requires:
  - the literal-false constant, the capability gate, fresh assurance, the active-session assertion, a session-sourced owner ID and the fixed revoke reason;
  - the shared locator-index module to be the only holder of the boundary HMAC label anywhere in `services`.

  It forbids a body-sourced owner ID, logging and mobile imports.
- **`scripts/claimant-offline-code-v2-isolation-check.cjs`.** The owner routes file is added by exact name to the files allowed to use the shared protocol normaliser, as the challenge and proof coordinators were before it.

## Evidence

- **Route unit tests: 9 tests.**
  - Registration stores exactly the sheet's fields, the session owner and the challenge route's locator index.
  - A session for another owner is refused.
  - The following are refused before persistence: tampered commitment, digest or proof key; changed grant or record ID; a wrong or corrupt locator; an extra owner ID, secret, sheet payload or vault key; stale or non-canonical timestamps; zero or over-365-day validity; a missing field; broken JSON.
  - AAL1, stale MFA, recovery or expired sessions are refused before the session assertion or persistence.
  - Invalid tokens, revoked sessions and a missing token are refused.
  - Wrong, claimant and alternate-API origins are concealed before any client is created.
  - Media type, idempotency key, size and preflight boundaries are enforced.
  - Database errors map to generic, value-free responses.
  - Revocation uses only the session owner and a fixed reason. It rejects a supplied reason or owner, and conceals a foreign record.
- **Acceptance: 3 tests.** The real 6F generator, the owner routes, the actual claimant challenge and proof routes and the claimant proof producer run together, with only the database replaced by an in-memory store modelled on the 5B SQL.
  - A freshly generated sheet registers.
  - The claimant's challenge for the printed locator returns the registered record, commitment, binding digest and KDF salt.
  - The claimant's possession proof verifies.
  - The secret and the sheet payload never reach the database call.
  - An exact retry replays. A changed retry, a duplicate and another owner's sheet are refused.
  - Revocation by a different owner or a second time is refused. After revocation, the claimant receives only a decoy challenge.
- **Mutation checks.** Deriving the index with the wrong scope failed both the unit test and the acceptance round trip. Setting the approval constant to true, or taking the owner from the body, failed the isolation check. Each change was reverted.
- **Workspace tests:** 1,615 passed, with three established skips (6F's 1,603 plus 12 new). **Serial script tests:** 296 passed.
- **API coverage thresholds pass.** Owner routes: 84% of lines. Shared locator-index module: 100%.
- **Other checks.** Typechecks and zero-warning lint pass. Security, Phase 1, mobile-secret and production-dependency checks pass, as do all 46 claimant isolation checks, including the new one.
- **Not run locally.** Expo Doctor and the web build were not run, because no mobile or web code changed. CI runs both.

No migration, mobile code, UI, persistence, hosted state or activation changed.

## Observations recorded, not changed

- **Two different "locator index" definitions.** The published 5A vector's `locator_digest` uses an HMAC over canonical JSON labelled `server-locator-index`. The deployed challenge route, the 5L database acceptance and now registration all use the `boundary` HMAC. Both registration and lookup use the deployed one, so they match. The vector's `locator_digest` is not what the server stores. Reconciling the two, or retiring that vector field, is a small follow-up.
- **The spec's known limitations stand.** The grant ID is not yet linked to a real release grant, the server cannot check the wrap, real-PostgreSQL acceptance needs Docker, and only the synthetic KDF profile exists.
