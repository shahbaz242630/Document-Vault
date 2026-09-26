# Staging wiring W1 — claimant features on in Vercel Preview only

Proposed on 2026-09-26, after Slice 7A merged through PR #102 at `b8c0cde`. It is the first hosted step after the owner's decision to stop coding offline-only. Awaiting owner approval.

## Why

Every claimant feature is still switched off by a constant that can never be true (`… = false as const`). That was right while the work was offline-only. The next step is to switch the features on in one place only: the protected Vercel Preview deployment of the existing projects, with synthetic data on the existing Supabase. Production must stay exactly as it is today.

The gate cannot be a simple environment flag. Today both environment guards decide "production" from `NODE_ENV` alone (`services/api/src/claimant/runtime-config.ts`, `apps/web/lib/claimant/runtime-config.ts`). Vercel sets `NODE_ENV=production` in Preview too, so any claimant flag set in Preview would make the API refuse to start. Nothing in the repo reads `VERCEL_ENV` yet.

## What the hosted side looks like today (read-only checks, 2026-09-26)

- **Supabase** (one project, eu-central-1, healthy). All 48 local migrations are recorded on the hosted database, including every claimant migration up to 7A (`20260926100000_claimant_single_approver_review`). None are missing, and there are no extras. The project's default Supabase branch is linked to this repository, which appears to apply migrations when they merge to `main`. So "apply the claimant migrations" is already done. W1 instead verifies that the hosted schema matches (see decision 4). I did not read any table contents.
- **Vercel `sanduqkin-api`** (root `services/api`, Git-linked to `main`, region `fra1`).
  - Every Preview and Production deployment except custom domains is behind Vercel Authentication.
  - Its environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the processor tokens and the account-deletion variables) are set for **Production only**.
  - Preview has none, so branch previews (Dependabot's included) build but have no database access.
- **Vercel `sanduqkin-web`** (root `apps/web`, same protection). It has no project environment variables.
- **No Vercel automation bypass** exists, so CI cannot reach a protected Preview (see `CLAIM_HANDOFF.md`, 5N staging note).

## Scope

1. **One deployment gate on the server.** A new module, `services/api/src/claimant/preview-activation.ts`, exposes `isClaimantPreviewActivated(env = process.env)`. It returns `true` only when **all** of these hold, and `false` otherwise, including when a value is missing, blank or differently cased:
   - `VERCEL === "1"`;
   - `VERCEL_ENV === "preview"`;
   - `VERCEL_GIT_COMMIT_REF === "claimant-preview"` (a single long-lived branch, see decision 2);
   - `CLAIMANT_PREVIEW_ACTIVATION === "synthetic-only"`.

   It reads nothing else, has no side effects, and is evaluated once per cold start, like `getClaimantRuntimeConfig`.

2. **Production detection fixed.** `getClaimantRuntimeConfig` works out the environment from `VERCEL_ENV` when it is present (`production` → production, `preview` → preview, `development` → development), and only otherwise from `NODE_ENV`.
   - In production it still refuses to start if any claimant flag is set, exactly as today.
   - In a preview that is not activated, claimant flags are ignored (every capability is off).
   - `CLAIMANT_PRODUCTION_ACTIVATION_APPROVED` stays `false as const` and untouched.

3. **The W1 route set, and only it, opened by the gate.** Each of the five gates on the offline-code V2 owner and possession path changes from `deps.approved ?? CONST` to `deps.approved ?? (CONST || isClaimantPreviewActivated())`. The constants themselves stay `false as const`: they still mean "approved for production", and remain false. The W1 set is:
   - owner routes (6G register and revoke, 6J list): `CLAIMANT_OFFLINE_CODE_V2_OWNER_ROUTES_APPROVED`;
   - locator persistence: `CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED`;
   - the claimant challenge and proof path: `CLAIMANT_OFFLINE_CODE_V2_CONTROLLER_APPROVED`, `…_CHALLENGE_COORDINATOR_APPROVED`, `…_PROOF_ATTEMPT_COORDINATOR_APPROVED`.

   The shared `OFFLINE_CODE_V2_PROTOCOL_APPROVED` is a descriptive constant that no gate reads, so it stays as it is.

   Everything else stays literal-false, including the handoff and case binding (claim start), intake, upload, owner protection, review, 7A, release, package and retrieval. The capability flags still apply on top: Preview sets only `CLAIMANT_RUNTIME_ENABLED`, `CLAIMANT_AUTHENTICATION_ENABLED` and `CLAIMANT_OFFLINE_CODE_V2_ENABLED`.

4. **Preview-only Vercel settings on `sanduqkin-api`**, scoped to the Git branch `claimant-preview` and nothing else. No other preview, and never Production, receives them:
   - the three capability flags above, plus `CLAIMANT_PREVIEW_ACTIVATION=synthetic-only`;
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, pointing at the existing project;
   - `OFFLINE_CODE_V2_API_ORIGIN`, which is the stable branch URL of the `claimant-preview` deployment;
   - `OFFLINE_CODE_V2_OWNER_ORIGIN` and `OFFLINE_CODE_V2_CLAIMANT_ORIGIN`: two fixed, distinct synthetic origins, recorded in the verification file and reused in W2 as `EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN` in the EAS preview profile;
   - `OFFLINE_CODE_V2_LOCATOR_INDEX_KEY`: a **new Preview-only key**, never reused for production;
   - `CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS=600`.

   The values are set through the Vercel API from the session environment. None are written to the repository, the logs or the verification record, which lists only variable names, targets and branch scope.

5. **Synthetic owner accounts.** Two synthetic owners are created in the existing Supabase Auth, on a reserved address pattern (for example `claimant-preview-owner-1@sanduqkin.com`), each enrolled in TOTP MFA. Their TOTP seeds are stored only as GitHub Actions secrets.

   A new script, `scripts/claimant-preview-synthetic-cleanup.cjs`, deletes every claimant row belonging to those user IDs, and then the users. It supports a dry run, refuses any user outside the reserved pattern, and is named in the go-live checklist (`docs/release-checklist.md`) as a required step.

6. **Hosted acceptance workflow.** `.github/workflows/claimant-preview-acceptance.yml` is manual-dispatch only and pinned to the `claimant-preview` branch. It:
   1. runs the live security catalog check read-only against the hosted database (decision 4);
   2. through the Vercel automation bypass (decision 3), checks `/health` and runs the 6G/6J acceptance flow with the real mobile client code (`owner-offline-code-client.ts`, the 6F generator and the 5C proof core), from Node, against the Preview API:
      - owner 1 signs in with password plus TOTP;
      - registers two sheets;
      - lists them;
      - revokes one after a fresh TOTP;
      - a claimant proves possession of the live sheet and gets only a decoy for the revoked one;
   3. confirms that owner 2 sees none of owner 1's sheets and cannot revoke them;
   4. confirms concealment: every W1 route returns 404 on a preview of any other branch and on Production.

7. **Deploy-time guard.** A new check, `scripts/claimant-vercel-env-guard.cjs`, runs in security CI when `VERCEL_TOKEN` is available, and otherwise in the acceptance workflow. It reads the variable **names and targets only** for both Vercel projects. It fails if:
   - any `CLAIMANT_*` or `OFFLINE_CODE_V2_*` variable targets Production;
   - any such variable targets Preview without the `claimant-preview` branch scope.

8. **Static isolation and tests.**
   - The isolation checks and mutation tests that match `false as const` for the five W1 constants are updated to allow exactly the `(CONST || isClaimantPreviewActivated())` form, and nothing looser. Every other check is unchanged.
   - A new isolation check requires that `preview-activation.ts` reads only the four variables and that only the W1 files import it.
   - Unit tests cover every combination of the four conditions, `VERCEL_ENV=production` with every flag set, and a preview on another branch.

## Acceptance

- **Production unchanged.**
  - The same `main` build with `VERCEL_ENV=production` refuses to start if any claimant flag is set.
  - With the Production variables as they are today, every claimant route returns 404.
  - The env guard passes on the live projects.
- **Previews on other branches unchanged.** Every claimant route returns 404, and those previews have no database credentials.
- **`claimant-preview` Preview.** The hosted acceptance flow in scope item 6 passes end to end, including the revoke-then-decoy step and the second owner's isolation.
- **Hosted schema.** The live catalog check shows 0 violations, and the hosted migration list equals the local one.
- **Nothing else opens.** On the activated Preview, the handoff, intake, upload, owner-protection, review, release and retrieval routes still return 404.
- **Checks.** Workspace tests, typechecks, lint, security and isolation checks, the API bundle check, the web build and full security CI all pass.
- **Evidence** goes in `docs/verification/2026-09-26-claimant-w1-preview-activation.md`: variable names and scopes, deployment IDs, the workflow run link and results. No secret values and no personal data.

## Owner decisions (recommendations in bold)

1. **The W1 route set: owner print, list and revoke, plus claimant possession proof. Starting a claim (handoff and case binding) waits for W2.** Starting a claim also needs hosted claimant accounts and the claimant portal session. That belongs with the phone build, where it can be tested end to end. The alternative is to include claim start now, which pulls claimant sign-up into W1.
2. **One long-lived `claimant-preview` branch, with Preview variables scoped to it.** Only that branch's preview gets database credentials and claimant flags, so Dependabot and feature previews can never switch anything on, and the API origin has a stable URL. The alternative is scoping the variables to all Preview deployments. That is simpler, but every PR preview would then hold the service-role key.
3. **Create a Vercel "Protection Bypass for Automation" secret for `sanduqkin-api`, stored only as the GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET`.** Earlier sessions required your explicit say-so for this. It does not weaken Vercel Authentication for people; it lets CI reach the protected Preview. Without it, hosted acceptance can't run. The alternative is to run the checks by hand in a browser session.
4. **Allow read-only catalog checks against the hosted database from CI.** These read only system catalogs (grants, row-level security, function settings), never table rows. The alternative is to trust the recorded migration list alone.
5. **Where the hosted steps run: a GitHub Actions workflow, using GitHub secrets.** This keeps credentials out of chat sessions and makes each run a linkable record. It needs `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN` and the two TOTP seeds as repository secrets. The alternative is running the steps from the Claude session that holds the tokens, with no GitHub secrets needed.
6. **Synthetic accounts in the live Auth project, cleared by the cleanup script before go-live.** This follows your reuse decision. The alternative is a separate Supabase project for staging, which you already declined.

## Non-goals

- Any change to Production variables, Production deployments or the production domain.
- Real owners, real claimants or real documents.
- The mobile build-time gate, the EAS preview profile and physical-phone print and scan evidence. These are W2.
- Claim start, intake, upload, review (including 7A), release and retrieval on hosted. These are W2 and W3.
- An email provider, and the owner notices that 7A's release depends on (W4).
- Removing or weakening Vercel Authentication.
