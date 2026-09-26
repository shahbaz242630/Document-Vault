# Staging wiring W1 verification — claimant features on in Vercel Preview only

Date: 2026-09-26. Built on Slice 7A (PR #102, `b8c0cde`). Scope: `docs/superpowers/specs/2026-09-26-claimant-w1-preview-activation.md`, approved by the owner on 2026-09-26 with all six recommended decisions. On the same day the owner also chose Vercel's client-address header as the trusted edge signal.

## What changed

- **Server gate.**
  - `services/api/src/claimant/preview-activation.ts` is true only when all of these hold: `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=claimant-preview` and `CLAIMANT_PREVIEW_ACTIVATION=synthetic-only`. The values must match exactly: no trimming, no case folding.
  - Only the owner routes (6G/6J) and the claimant challenge and proof controller use it, as `deps.approved ?? (CONST || isClaimantPreviewActivated())`.
  - Every production approval constant is still `false as const`.
- **Runtime config.**
  - `VERCEL_ENV` now decides the environment whenever Vercel sets it, because Vercel runs Preview with `NODE_ENV=production`.
  - Production still refuses to start if any claimant flag is set.
  - A preview that isn't activated ignores every claimant flag.
  - An activated preview is capped to `authentication` and `offlineCodeV2`.
- **Portal session.** The claimant portal session routes return 404 on the activated Preview until W2.
- **Trusted edge signal.**
  - `vercel-trusted-signals.ts` reads only `x-vercel-forwarded-for`, and only on Vercel. It accepts one IP address.
  - It is wired into the mounted challenge route. Off Vercel, the route still refuses with 503.
- **Guards and checks.**
  - The new isolation check `claimant-preview-activation-isolation-check.cjs` pins:
    - the four variables the gate reads;
    - the exact gate form;
    - the Preview capability cap and the portal concealment;
    - the trusted-signal header rules;
    - that nothing outside the W1 files imports the gate.
  - The 6G owner-routes check and the controller check now also require the exact gate form.
- **Hosted tooling.**
  - `claimant-vercel-env-guard.cjs` reads Vercel variable names, targets and branch scopes only.
  - `claimant-preview-hosted-catalog-check.cjs` is read-only. It checks system catalogs and the migration history, never table rows.
  - `claimant-preview-synthetic-cleanup.cjs` does a dry run by default. Its reserved address pattern is fixed in the SQL.
  - `services/api/scripts/claimant-preview-acceptance.ts` is the hosted acceptance script.
  - The manual workflow `.github/workflows/claimant-preview-acceptance.yml` runs them in the GitHub `Preview` environment.
  - The release checklist gains two claimant go-live steps: the cleanup and the env guard.

## Hosted configuration applied

- **Git branch `claimant-preview`** is created from this work. Vercel builds its Preview at the stable alias `https://sanduqkin-api-git-claimant-preview-shahbaz-ali-maliks-projects.vercel.app`.
- **Vercel `sanduqkin-api` variables.** All twelve target Preview only, with branch scope `claimant-preview`:
  - `CLAIMANT_RUNTIME_ENABLED`, `CLAIMANT_AUTHENTICATION_ENABLED`, `CLAIMANT_OFFLINE_CODE_V2_ENABLED`;
  - `CLAIMANT_PREVIEW_ACTIVATION`, `CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS`;
  - `SUPABASE_URL`;
  - `OFFLINE_CODE_V2_API_ORIGIN`, `OFFLINE_CODE_V2_OWNER_ORIGIN`, `OFFLINE_CODE_V2_CLAIMANT_ORIGIN` (encrypted);
  - `SUPABASE_SERVICE_ROLE_KEY`, `OFFLINE_CODE_V2_LOCATOR_INDEX_KEY`, `OFFLINE_CODE_V2_RATE_LIMIT_KEY` (sensitive).

  The two offline-code keys were newly generated for Preview (32 random bytes each) and are not used anywhere else. No value appears in the repository, the logs or this record. Production variables are unchanged.
- **Synthetic origins:** owner `https://owner.claimant-preview.sanduqkin.invalid`, claimant `https://claimant.claimant-preview.sanduqkin.invalid`. W2 reuses the owner origin as `EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN`.
- **Supabase:** no migration or schema change. TOTP MFA was already enabled for enrolment and verification.

## Evidence

- **Env guard** (live, both projects): passed.
- **Hosted database** (read-only): all 48 local migrations are applied, with none missing and none unknown, and there are 0 catalog violations. The one exception is Supabase's own `rls_auto_enable()`, which no API role can execute.
- **Hosted acceptance**, run from the session against claimant-preview deployment `dpl_4TeU5RgZw1VHQ8hUMFfgFDSt9psW` (commit `7e6bdc5`, identical server code): all 11 checks passed.
  1. API `/health` responds.
  2. Two synthetic owners sign in with password and TOTP (AAL2).
  3. Owner 1 generates and registers two sheets through the real 6H flow.
  4. The list shows both sheets as active.
  5. After a fresh TOTP, owner 1 revokes one, and the list shows it as revoked.
  6. Owner 2 sees none of owner 1's sheets and gets 404 revoking one.
  7. The revoked sheet's locator yields only a decoy challenge.
  8. A claimant proves possession of the live sheet through the hosted challenge and proof routes (`route_possession_asserted: true`).
  9. On the activated Preview, all of these return 404: handoff issue and complete, `/claimant/session/activate`, portal session activate and assert, registered-recipient invitations, native-enrollment challenges, and case submission.
  10. The W1 routes return 404 on another branch's preview.
  11. The W1 routes return 404 on the Production deployment.

  Cleanup then removed 2 users, 2 sheets and 1 challenge. A later dry run reported 0 users, 0 sheets and 0 challenges.
- **Local checks:** workspace tests, typechecks, lint, security checks and every serial script test pass (counts below).

## Local checks

- `npm run typecheck`: passed.
- `npm run lint`: 0 warnings.
- `npm test --workspaces`: 1,705 passed, with the 3 established skips (API 423, including the new Preview gate, runtime-config, route-gate and trusted-signal tests).
- `npm run check:security`: passed.
- Both security-CI `node --test` script sets, run serially: 217 and 48 passed, 0 failed. The second set includes the four new W1 script tests.
- `node scripts/github-actions-security-check.cjs`: passed, including the new workflow.

## Not covered, and why

- **The owner app has no session activation step.** The acceptance activates each synthetic session with the same service-only function the closed `/claimant/session/activate` route uses. W2 must add the real step (see the spec's Implementation notes).
- **The workflow hasn't run on GitHub yet.** It needs `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN` in the GitHub `Preview` environment, which only the owner can add. The same script passed from the session.
- **Leftover rows.** Rate-limit buckets and decoy-challenge idempotency rows stay behind by design. They are keyed digests and random values with no user link.
- **Not part of W1:** physical phones, the mobile build-time gate, the EAS preview profile, claim start, review, release and any Production change. These are W2 and later.
