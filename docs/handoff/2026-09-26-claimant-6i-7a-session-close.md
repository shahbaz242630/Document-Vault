# Claimant 6I–7A session close — 2026-09-26

This is the current checkpoint and the opener for the next session. It supersedes `2026-09-25-claimant-6f-6h-session-close.md`.

## Delivered and merged

- **PR #100 (`0edd2a8`): Slice 6I, the claimant camera QR scanner.**
  - The claim screen scans the printed emergency-sheet QR code with `expo-camera`: camera permission only, QR only, one sheet per scan.
  - The camera is unmounted as soon as a sheet is read, and screen capture is blocked.
  - The paste field is removed.
  - Acceptance decodes the QR image the owner actually prints and starts exactly one claim through the real routes.
  - The PR also carried PR #99's 6F–6H close-out.
- **PR #101 (`9d07c65`): Slice 6J, "My emergency sheets".**
  - A service-only, read-only list function and a concealed `GET /owner/offline-code/v2/locators` route return the owner's sheets, with dates and status only.
  - Revoke still needs a fresh TOTP, with the same idempotency key across the step-up.
  - Printed sheets now carry a short reference ("Ref 3F9A1C"), which the list shows too.
- **PR #102: Slice 7A, the single human approver.** It merges at session close with CI green; the next session confirms its merge commit on `main`.
  - Review mode is set by policy, and the two-person path is unchanged.
  - Deterministic pre-checks can only block. An allow is accepted only from an `accountable_human_test` identity.
  - Single-approver cases have a minimum 30-day cooldown.
  - Approval opens a 7-day dispute window, started by a verified owner notice. The owner, the claimant, another next of kin or a material change can hold it.
  - Release needs an undisturbed window, a clear pre-check taken after it, and the same person re-confirming with fresh MFA.
  - Everything is covered by a hash-chained audit trail.
  - 4B and 4C are regenerated with one condition changed.
  - The DB test passed on real Postgres (PGlite, all migrations), and 4 mutation tests prove its guards.

Everything remains synthetic-only, literal-false and unmounted. There was no hosted migration, deployment, real data or activation.

## Owner decisions this session

1. **Reviewer model:** Shahbaz Malik is the only human who approves a release. Claude runs automated checks and is never a reviewer or approver. The approved 7A safeguards apply:
   - deterministic pre-checks only (no AI reading evidence);
   - a minimum 30-day cooldown;
   - a 7-day dispute window;
   - no override of blocking pre-checks;
   - no self-resolution of escalations or appeals.

   `docs/verification/2026-08-18-interim-reviewer-test-roles.md` carries the superseding go-live gate.
2. **Hosting:** reuse the existing Supabase and Vercel projects, with no separate staging projects. Claimant features are switched on only in Vercel's protected Preview environment, never in Production. Synthetic claimant data is cleared before go-live. The owner has authorised hosting changes.
3. **Stop coding offline-only.** Offline-only slices stop here. The next phase wires the claimant side into the hosted environment and on to production.
4. **Working rules:**
   - no pull request for documentation or admin changes alone; docs always travel with the code they describe;
   - each PR gets a watcher that merges with a merge commit when green, and fixes and re-runs when red.

## Tooling note for the next session

This container has no Docker. Database changes were verified locally with **PGlite** (Postgres 17 in WebAssembly) by applying every migration from `supabase/migrations` in order, over stub `auth`/`storage` schemas and Supabase roles. The `scripts/claimant-*-db-test.cjs` builders were then run against that database. The harness lives in the session scratchpad, not the repo. If it's needed again:
- install `@electric-sql/pglite` in a scratch folder;
- create the roles `anon`, `authenticated` and `service_role`;
- create the `auth.users` table and the `extensions` schema with `pgcrypto`;
- apply the migrations.

The owner-protection and owner-notice-queue DB tests apply their own migrations, so they don't run on a fully migrated database.

## Pending — engineering

1. **7B: the reviewer console.** The API routes and a screen where the owner sees a single-approver case and records the decision and the release re-confirmation. Build it against staging.
2. **Staging wiring (W1–W2):**
   - turn the literal-false switches into an environment setting that can be on only in Vercel Preview;
   - apply the claimant migrations to the existing Supabase;
   - set the owner-origin variables (`EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN`, `OFFLINE_CODE_V2_OWNER_ORIGIN`);
   - produce an internal build for physical-phone print and scan evidence.
3. **Remaining screens against staging (W3):** registered next-of-kin invitation, evidence upload, claimant dashboard, and retrieval and local open.
4. **Production readiness (W4–W5):**
   - a production Argon2id KDF profile;
   - Secure Enclave and App Attest evidence from physical devices;
   - an email provider, for the owner notices that 7A's release depends on;
   - backup and restore, deletion, observability and rollback;
   - a frozen release candidate and a readiness report.
5. **Smaller items:**
   - reconcile the 5A vector's `locator_digest` with the deployed index;
   - link grant IDs to real release grants;
   - add an account-age pre-check once hosted accounts exist;
   - run a single-approver 4B/4C package and manifest end to end during retrieval wiring.

## Pending — owner-held

- **Tokens for hosted work:** `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN`, either in the cloud environment settings or as GitHub repository secrets (preferred: a GitHub Actions workflow runs the hosted steps). The Vercel API may also need allowing in the environment's network settings.
- **Accounts and services:** Supabase Pro (hosted MFA), EDGE-01 to EDGE-03, the production domain, and the email provider choice.
- **Legal review:** the public documents, plus confirmation that the single-approver process is acceptable in each launch market.
- **App Store release.**
- **PR #97 (Dependabot, 22 package updates):** untouched. Merge it only on the owner's word, after checking it's green.

## Next-session opener

> Continue the Sanduqkin claimant work in `shahbaz242630/Document-Vault`. Read `docs/handoff/2026-09-26-claimant-6i-7a-session-close.md`, `CLAIM_HANDOFF.md`, and the 7A spec and verification record. Confirm PR #102 (7A) is merged and its head is on `main`. If the Supabase and Vercel tokens are now available, start staging wiring W1 by specifying it for my approval: environment-controlled switches (Preview only), claimant migrations on the existing Supabase, and the owner-origin variables. Otherwise write the 7B reviewer console spec for my approval. Docs go with code; use a PR watcher that merges when green.
