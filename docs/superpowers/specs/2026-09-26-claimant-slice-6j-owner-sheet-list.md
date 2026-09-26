# Slice 6J — "My emergency sheets": list and revoke

Proposed on 2026-09-26, after Slice 6I (PR #100). Approved by the owner on 2026-09-26, with both decisions below. It closes the 6H limitation that only the sheet from the current session can be revoked.

## Gap

Once 6H drops a printed sheet from memory, the owner has no way to see it or revoke it. If a sheet is lost, or given to someone the owner no longer trusts, it stays live until it expires, which can be up to 365 days. The server has the records (`claimant_offline_code_v2_locators`), but they are server-only, and no route lists them.

## Scope

1. **Migration: one service-only read function.** `claimant_list_offline_code_v2_locators(p_owner_user_id uuid)`:
   - it returns the owner's own sheets only, newest first, capped at 50;
   - each row has `locator_record_id`, `status` (`active`, `revoked` or `expired`), `issued_at`, `expires_at` and `revoked_at`;
   - an `active` row past `expires_at` is reported as `expired`, and the row itself is not changed;
   - it never returns the locator digest, the commitment, the proof key, the wrap, the salt, the grant or attempt counters;
   - it is `security invoker` and `stable`, with an empty `search_path`, and `execute` is granted to `service_role` only, exactly like the 5B functions. It is added to the live catalog security check's allowlist.

2. **Owner list route.** `GET /owner/offline-code/v2/locators`, gated by the same literal-false constant and `offlineCodeV2` capability as 6G, so the mounted app returns 404 for it.
   - It needs the exact owner origin and an active AAL2 owner session. The owner ID comes only from the session.
   - It does **not** need MFA from the last 10 minutes, because listing reveals no secret. Revoking still needs it, unchanged from 6G.
   - The response is strictly validated and `Cache-Control: no-store`, like the 6G responses. A request body is refused.
   - The CORS preflight on the list path allows `GET` with the `Authorization` header only; the revoke path still allows `POST` only.

3. **Mobile client and flow.**
   - `owner-offline-code-client.ts` gains `list()`, with strict response parsing, a 15-second timeout and abort on cancel.
   - A small list controller loads the sheets, then revokes one. Revoke reuses the 6H fresh-TOTP step-up and keeps the same idempotency key on retry. After a revoke the list refreshes.

4. **Screen and entry point.**
   - A new route, `app/settings/emergency-sheets.tsx`, opened from a "My emergency sheets" row on the Emergency access screen, next to "Print an emergency sheet".
   - Each sheet shows its printed date, "Valid until", its status and, when active, a **Revoke** button. Revoke asks for confirmation first: "Anyone holding this sheet will no longer be able to start a claim with it."
   - The row appears only when the flow handle is non-null. The normal app hides it and the route shows "unavailable", the same inert pattern as 6E and 6H.

5. **Static isolation.** The 6G owner-routes check and the 6H owner-sheet check are extended:
   - the new route is gated and concealed;
   - the SQL function returns only the allowed columns;
   - no storage or logging is added;
   - the screen imports only the flow handle.

## Acceptance

- **List and revoke, end to end.** An extension of the 6G/6H acceptance harness:
  1. The owner prints two sheets through the real 6H flow.
  2. The list route shows both as active.
  3. The owner revokes one from the list, with the TOTP step-up.
  4. The list shows it as revoked, and the claimant challenge for it returns only a decoy.
  5. The other sheet still verifies.
- **Another owner's sheets** never appear, and cannot be revoked.
- **No secrets.** Nothing in the list response or the screen state is secret, and the list request carries no body.
- **Expiry.** A sheet past its expiry lists as `expired` and offers no Revoke.
- **Database (Docker-backed, in CI's local Supabase job).**
  - The function exists, is `service_role`-only and returns the allowed columns only.
  - Anonymous and authenticated callers are denied.
  - Row-level security still denies direct table reads.
- **Disabled by default.** The route returns 404, the entry is hidden, and no network call is made.
- **Checks.** Workspace tests, typechecks, lint, the security and isolation checks, Expo Doctor, the web build and CI all pass, including the native builds and the live-security job.

## Owner decisions (approved 2026-09-26)

1. **Print a short reference on each sheet. Approved.** The server never sees the printed sheet code, so today the list can show only dates. I recommend printing a short reference on the sheet, the first 6 characters of the record ID in capitals (for example "Ref 3F9A1C"), and showing the same reference in the list. The record ID is not secret: the server already uses it to identify the sheet. The alternative is dates only, which is fine if the owner rarely has more than one sheet.
2. **List without a fresh TOTP. Approved.** Listing shows only dates and statuses. Revoking keeps the fresh-TOTP step-up. The alternative is to ask for a TOTP code just to view the list.

## Non-goals

- Renaming or labelling sheets (no personal notes are stored on the server).
- Reprinting an existing sheet. That is impossible by design: the secret is never stored.
- Notifying a next of kin about a revoke.
- Deployment, hosted migration and real data. Hosted rollout happens in the staging wiring phase.
