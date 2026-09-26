# Slice 7A verification — single human approver with automated pre-checks and safeguards

Date: 2026-09-26. Built on `main` at `9d07c65` (PR #101). Scope: `docs/superpowers/specs/2026-09-26-claimant-slice-7a-single-approver-review.md`. The owner approved it on 2026-09-26 with all five recommended decisions:
- deterministic pre-checks, no AI reading evidence;
- a minimum 30-day cooldown;
- a 7-day dispute window;
- no override of blocking pre-checks;
- no self-resolution of escalations or appeals.

## What changed

**Migration `20260926100000_claimant_single_approver_review.sql`:**
- **Review policy.** `claimant_review_policies` sets the review mode, minimum cooldown and dispute window per policy pack. Single-approver mode requires at least 30 days and 7 days.
  - A trigger makes the round's `review_mode` match the policy on insert and never change afterwards.
  - Rounds gain the `single_approved` status. Interventions and release authorizations record the mode.
- **Pre-checks.** `claimant_run_review_precheck` evaluates up to 15 deterministic checks (12 shared, plus 1 in the decision phase or 3 in the release phase) in the same transaction and stores each run. The checks:
  - policy mode, current case, claimant is not the owner;
  - verified owner notice, cooldown elapsed, cooldown at least the policy minimum;
  - submission received, checklist complete, evidence complete;
  - no other open claim on the vault, no intervention, recipient keys and grants current;
  - in the release phase: round approved, evidence unchanged since the decision, dispute window elapsed.
- **Decision.** `claimant_record_single_approver_decision` accepts only:
  - the slot-1 assignment;
  - an active `accountable_human_test` identity who is neither the owner nor the claimant;
  - a policy-minimum cooldown;
  - a decision pre-check taken at the current case version within 24 hours, which must be `clear` for an allow.

  An allow creates the round as `single_approved` and opens a dispute window awaiting the owner notice.
- **Approval notice and holds.**
  - `claimant_record_approval_notice_delivery` starts the 7-day window only on verified delivery; a failed delivery holds the approval.
  - `claimant_hold_single_approval` lets the owner, the claimant, another accepted next of kin of the same owner, or the system (for a material change) hold the approval.
  - The existing 3A owner cancellation and claimant dispute also stop release, because release requires an active owner-protection cycle.
- **Release.** `claimant_authorize_single_approver_release` requires every 4A prerequisite, plus:
  - an elapsed, undisturbed window;
  - a clear release pre-check taken after it, within the last hour;
  - the same person's release-authority identity;
  - a fresh-MFA time within 10 minutes;
  - no intervention on the case.
- **4B and 4C.** `claimant_prepare_encrypted_release_package` and `claimant_finalize_signed_release_package` are regenerated from the originals with one condition changed: they accept a two-person round only on a two-person authorization, and a single-approver round only on a single-approver authorization.
- **Audit chain.**
  - `claimant_review_audit_chain` hash-links every reviewer-assignment, review, intervention, release and single-approval event, computed in UTC.
  - `claimant_verify_review_audit_chain` recomputes the chain and also detects unchained events.
  - `claimant_export_review_audit` returns only the step, event type, time and hash.
- **Access.** Every new table is forced-RLS, with an explicit deny for `anon`/`authenticated` and a narrow `service_role` grant. Every new function is `security invoker` with an empty `search_path` and executable by `service_role` only.

**API.** `single-approver-review-service.ts` is literal-false and unmounted. `single-approver-review-transaction-client.ts` parses every result strictly and cross-binds it to the request.

**Checks.**
- New security-CI tests: the migration's static contract (including proof that 4B and 4C differ from the originals in exactly one condition), the DB-test builder, and an isolation check.
- A new Docker-backed step, `check:claimant-single-approver-review-db`, in the Supabase job.
- The live catalog check now covers the 6 tables and 10 functions.

**Documents.** The spec is marked approved and aligned with the build. The interim reviewer roles record gets a superseding note with the new go-live gate. The four handoffs are updated.

## Evidence

- **Full DB test on real Postgres** (PGlite, all 47 migrations applied, because this environment has no Docker). Every step passes:
  1. No decision is accepted without a pre-check, and the two-person path cannot open a round for a single-approver case.
  2. A short cooldown blocks. A blocking pre-check alone stops an allow (a revoked grant makes it blocking), though a hold is still possible. A non-human identity cannot decide.
  3. The approval produces exactly one decision. Replay is stable, and a changed replay is refused.
  4. Release is refused before the notice, and the release pre-check blocks while the window runs.
  5. A stranger cannot hold the approval. A next-of-kin hold and an owner cancellation each stop release.
  6. A grant change blocks the release pre-check.
  7. A stale re-confirmation, a different authorizer and a decision pre-check used for release are each refused.
  8. The release succeeds with `review_mode: single_approver`, the window closes, and replay is stable.
  9. The audit chain verifies. The export has no reasons, digests or user IDs. An edited event and a deleted chain entry are each detected.
  10. The `authenticated` role is denied the tables and functions.
- **Mutation tests.** Each of these weakenings makes the DB test fail:
  - forcing the cooldown-minimum check to pass;
  - removing the "allow needs a clear pre-check" rule;
  - dropping the next-of-kin invitation check;
  - dropping the "same person must re-confirm" rule.
- **Regression.** Every other claimant DB test passes on the migrated schema. That includes the 3E/3F/3G/4A two-person tests, 4B/4C package and manifest, retrieval, and the offline-code tests. The owner-protection and owner-notice-queue tests apply their own migrations and can't run in this local harness either with or without 7A. They are unaffected and are not part of the CI Supabase job.
- **Catalog check.** The real `supabase-db-security-check` analyzer finds 0 violations on the migrated schema.
- **End-to-end client test.** A throwaway test drove the TypeScript transaction client through the real SQL: pre-check, allow, notice, window, release pre-check, release and verified audit export. It passed, confirming every result schema, and was then deleted.
- **Unit tests.** 7 service and client tests:
  - disabled by default;
  - reason, actor and override refusals;
  - pre-check outcome consistency;
  - the decision/window binding;
  - a release that stops at authorization;
  - a gap-free, value-free audit export.

## Local gates (all passed)

- `npm run typecheck`, `npm run lint` (zero warnings).
- `npm test --workspaces`: **1,692 passed, 3 established skips**. By workspace:
  - mobile: 918 passed, 3 skipped;
  - the other four: 171, 151, 42 and 410 passed.
- Coverage thresholds for mobile and API.
- `check:security`, `check:github-actions-security`, `check:mobile-secrets`, `check:phase1`, `check:production-dependencies`.
- Every security-CI `node --test` batch: **290 script tests** passed.

## Not covered here

- **Docker-backed DB steps:** the live Docker steps run in CI.
- **Review console:** the reviewer console (7B) is not built.
- **Email provider:** no email provider exists, so an owner notice can't actually be delivered yet, and nothing can be released. That is the safe direction.
- **Package step on the single-approver path:** the patched 4B and 4C accept a single-approver authorization only on a single-approver round, and a static test proves nothing else changed. A single-approver package and manifest run is left to the retrieval wiring slice.
- **Launch state:** everything stays synthetic, literal-false and unmounted. There is no hosted migration, deployment, real data or activation.
