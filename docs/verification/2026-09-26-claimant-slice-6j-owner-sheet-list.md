# Slice 6J verification — "My emergency sheets": list and revoke

Date: 2026-09-26. Built on Slice 6I (PR #100). Scope: `docs/superpowers/specs/2026-09-26-claimant-slice-6j-owner-sheet-list.md`, approved by the owner on 2026-09-26 with both decisions (print a short reference on each sheet; list without a fresh TOTP).

## What changed

- **Migration** `20260926090000_claimant_offline_code_v2_owner_locator_list.sql` adds one function, `claimant_list_offline_code_v2_locators(p_owner_user_id)`.
  - It is `stable security invoker`, with an empty `search_path`, and executable by `service_role` only.
  - It returns the owner's own sheets, newest first, at most 50.
  - Each sheet carries only `locator_record_id`, `status`, `issued_at`, `expires_at` and `revoked_at`.
  - An overdue active sheet is reported as `expired`, and the row is not changed.
  - The live catalog security check's allowlist includes it.
- **API**
  - The route `GET /owner/offline-code/v2/locators` is concealed by the 6G literal-false constant and the `offlineCodeV2` capability, so the mounted app returns 404.
  - The route needs:
    - the exact owner origin and API origin;
    - a bearer token;
    - an active AAL2 owner session without recovery (checked with `assertActiveSession`);
    - no request body.
  - It does not need a fresh MFA step-up; revoke still does.
  - The owner ID comes only from the session.
  - A separate `createOfflineCodeV2OwnerSheetReader` parses the result strictly. It rejects extra fields, inconsistent revocation facts and unsafe envelopes, and normalises PostgreSQL timestamps to ISO.
  - The list path's preflight allows `GET` with `Authorization` only.
- **Mobile**
  - `owner-offline-code-client.ts` gains `list()`: a bodiless GET with strict parsing, a 15-second timeout and abort.
  - `owner-sheet-list-flow.ts`:
    - loads the list, then confirms and revokes;
    - on a 403, asks for a fresh TOTP and retries with the **same** idempotency key;
    - refreshes the list after a revoke;
    - `close()` aborts any request and ignores late results.
  - `owner-sheet-list-view-model.ts` and `owner-sheet-list-panel.tsx` show each sheet's reference, printed date, validity and status, with Revoke on active sheets and a confirmation step.
  - `app/settings/emergency-sheets.tsx`, plus a "My emergency sheets" button on Emergency access. The button is shown only when the list handle is non-null.
  - `owner-sheet-reference.ts` provides the reference: the first six characters of the record ID, in capitals. The 6H printed sheet now shows "Reference".
  - `createOwnerSheetListHandle` sits behind the same literal-false `OWNER_SHEET_FLOW_LAUNCH_APPROVED` as 6H. It shares the TOTP step-up with the 6H flow.
- **Checks**
  - The 6G owner-routes check now covers the list route, which takes no caller input and has a strict, secret-free schema.
  - The 6H owner-sheet check now covers the list files. They have no storage, logging, sheet material, crypto or printer, and the launch approval gates them.
  - Two new script tests: the migration's static contract, and the DB test builder.
  - A new live DB step, `check:claimant-offline-code-v2-owner-list-db`, runs in the security-CI Supabase job.

## Evidence

- **Acceptance** (`offline-code-v2-owner-registration-acceptance.test.ts`, Slice 6J block; the store models the new SQL function):
  1. The owner prints two sheets through the real 6H flow, and the printed sheet carries the reference.
  2. With stale MFA, the list loads through the real route and shows both sheets as active, with no secret in the state.
  3. The owner requests a revoke, confirms, is asked for a fresh code, verifies, and the revoke goes through the real 6G route.
  4. The first sheet now yields only a decoy to the claimant. The second still proves possession through the actual challenge and proof routes.
  5. Another owner sees an empty list and cannot revoke the first owner's sheet.
- **Database, run locally on real Postgres** through PGlite (Postgres 17 compiled to WebAssembly, installed outside the repository), because this environment has no Docker:
  - both migrations and the new one apply;
  - the owner list returns only the owner's sheets, newest first, with statuses `active, revoked, expired` and the five allowed keys;
  - listing does not change a row;
  - an unknown owner sees nothing;
  - `anon` and `authenticated` get `permission denied`;
  - `prosecdef = false`, `search_path=""` and `stable` are confirmed;
  - the CI DB test script's SQL (`--standalone` form) passes end to end with its marker.
- **Unit tests**
  - List-route concealment, owner-only listing, AAL2 without freshness, rejection of AAL1, expired and recovery sessions, token, origin and body refusals, generic 503, and the GET-only preflight on the list path.
  - The sheet reader's normalisation and rejections.
  - Mobile: the reference and printed layout, client parsing and failures, and the flow. The flow tests cover revoke with the same key across the step-up, rejected codes, active-only revoke, keeping the list on failure, cancel, and late results after close. They also cover the view rows and confirmation text, and the literal-false handle.

## Local gates (all passed)

- `npm run typecheck`, `npm run lint` (zero warnings).
- `npm test --workspaces`: **1,685 passed, 3 established skips**. By workspace:
  - mobile: 918 passed, 3 skipped;
  - the other four: 171, 151, 42 and 403 passed.
- Coverage thresholds for mobile and API.
- `check:security`, `check:github-actions-security`, `check:mobile-secrets`, `check:phase1`, `check:production-dependencies`.
- Every security-CI `node --test` batch: **283 script tests** passed.

## Not covered here

- **Live DB step:** the Docker-backed step runs in CI only. The same SQL passed locally on PGlite.
- **Launch state:** all launch controls stay false. There is no hosted migration, deployment, real data or activation; hosted rollout is part of the staging wiring phase.
