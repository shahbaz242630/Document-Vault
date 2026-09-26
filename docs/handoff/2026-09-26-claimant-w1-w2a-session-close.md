# Claimant W1–W2a session close — 2026-09-26

This is the current checkpoint and the opener for the next session. It supersedes `2026-09-26-claimant-6i-7a-session-close.md`.

**Where this file lives:** on the branch `claude/gifted-turing-lm2en4`. By the owner's rule (no docs-only PRs), it reaches `main` with the first W2b code PR. If `main` doesn't have it yet, read it from that branch.

## Delivered and merged

- **PR #103 (`53c3d40`): W1, claimant features on in Vercel Preview only.**
  - **Server gate.** `preview-activation.ts` is true only when `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=claimant-preview` and `CLAIMANT_PREVIEW_ACTIVATION=synthetic-only` all hold. It opens only the 6G/6J owner routes and the claimant challenge and proof routes.
  - **Environment detection.** `VERCEL_ENV` decides the environment on Vercel. Production refuses any claimant flag, and an activated Preview is capped to `authentication` and `offlineCodeV2`.
  - **Trusted edge signal (owner decision).** Vercel's `x-vercel-forwarded-for` header, only on Vercel.
  - **Tooling:**
    - the env guard (`scripts/claimant-vercel-env-guard.cjs`);
    - a read-only hosted catalog check;
    - the synthetic cleanup (now a go-live step in `docs/release-checklist.md`);
    - the hosted acceptance (`npm run test:claimant-preview-acceptance --workspace services/api`);
    - the manual workflow `claimant-preview-acceptance.yml`.
- **PR #104 (`eeb178e`): W2a, owner session activation and the Sanduqkin Preview app.**
  - **Owner session.** A new route, `POST /owner/session/activate`. The app calls it after the sign-in TOTP check and after every fresh-TOTP step-up, which closes the W1 gap where owners got 401.
  - **The Sanduqkin Preview app.** It is a separate app: target `claimant_preview`, bundle ID and package `com.sanduqkin.mobile.claimantpreview`, EAS profile `claimant-preview`.
    - Its gate is `isClaimantPreviewBuild()`, which needs the inlined switch and the native app marker together.
    - `app.config.js` refuses the switch anywhere else, and refuses the target under the production profile.
  - **The Preview app's screens.** In it the owner print and list screens open, plus a new "Check an emergency sheet" camera screen. The check screen proves possession only and starts no claim.
  - **Build workflow.** `claimant-preview-build.yml` is manual and runs from `main` with the `Release` environment. It only queues an EAS build.

**Evidence.** Hosted acceptance passed 11 of 11 against the Preview, with the owners activated through the real route; synthetic data was cleaned to 0. Local checks: 1,744 workspace tests (3 established skips), every CI script set, lint, typecheck, Expo Doctor and the security checks. Full CI was green on both PRs before merge.

## Live hosted state

- **Supabase** (`pxwtexjjttpgtairpepz`): all 48 migrations are applied, with 0 catalog violations; there was no schema change this session. TOTP MFA is on. The only synthetic data is per-run, and it is removed each time.
- **Vercel `sanduqkin-api`:**
  - **Variables.** 12 Preview variables scoped to the `claimant-preview` branch: the three capability flags, `CLAIMANT_PREVIEW_ACTIVATION`, `CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the API, owner and claimant origins, and new Preview-only `OFFLINE_CODE_V2_LOCATOR_INDEX_KEY` and `OFFLINE_CODE_V2_RATE_LIMIT_KEY`. Production variables are unchanged.
  - **Origins.**
    - API origin: `https://sanduqkin-api-git-claimant-preview-shahbaz-ali-maliks-projects.vercel.app`.
    - Owner origin: `https://owner.claimant-preview.sanduqkin.invalid`.
    - Claimant origin: `https://claimant.claimant-preview.sanduqkin.invalid`.
  - **Domain.** `preview-api.sanduqkin.com` is attached to the `claimant-preview` branch. It waits for DNS.
- **Git.** `claimant-preview` equals `main` (`eeb178e`). Move it up to `main` after every merge.

## Owner decisions this session

1. W1 was approved with all six recommendations. The trusted edge signal is Vercel's own client-address header.
2. W2 is split into W2a (phones) and W2b (claim start). W2a was approved with all five recommendations: a custom domain, a separate Preview app, a build workflow, and the sheet-check screen.
3. **Working rule:** PR watchers now merge automatically once CI is green (a merge commit), then move `claimant-preview` up to `main`. The auto-approval system in these sessions still blocks an unprompted merge, so the owner's go-ahead is recorded in each watcher's check-in message.
4. **Tokens:** the hosted acceptance may run locally from a `.env` file. GitHub `Preview` environment secrets are optional; if used, restrict the environment to the `claimant-preview` branch. Rotate the Supabase and Vercel tokens after this session.

## Pending — owner-held (needed before phone evidence)

1. **DNS:** a CNAME `preview-api` → `cname.vercel-dns.com` at the `sanduqkin.com` registrar (nameservers `*.dns-parking.com`). After that, switch `OFFLINE_CODE_V2_API_ORIGIN` for the `claimant-preview` branch to `https://preview-api.sanduqkin.com`, redeploy, and rerun the acceptance with `CLAIMANT_PREVIEW_API_ORIGIN` set to that value.
2. **First credentials for the Preview app:**
   - **Android:** `eas credentials` once for `com.sanduqkin.mobile.claimantpreview`. EAS won't create a keystore non-interactively.
   - **iOS:** `eas device:create` for the test phone.
   - Also make sure the EAS `preview` environment has the public Supabase URL and publishable key.
3. **Build:** Actions → "Claimant Preview app build" on `main`, choosing `android`, with the confirmation `claimant-preview`.
4. **Phone run:**
   1. Sign in as a synthetic owner with TOTP.
   2. Print a sheet, and list it.
   3. Print and revoke a second one.
   4. On a second phone, check the live sheet ("valid") and the revoked one ("can't be used").
   5. Run the cleanup until it reports 0.
   6. Record the results in `docs/verification/2026-09-26-claimant-w2a-phone-preview.md`.
5. **Rotate** the Supabase and Vercel access tokens used this session.
6. **Carried forward:** Supabase Pro, EDGE-01 to EDGE-03, the email provider, legal review, the App Store, and Dependabot PR #97 (only on the owner's word).

## Pending — engineering

1. **W2b, claim start (spec it first, for approval).** Research findings to build on:
   - **Claimant sign-in.** The app has none. A Supabase-backed hosted identity provider is needed for an AAL2 claimant.
   - **Claimant portal session.** `/claimant/portal/session/activate|assert` is concealed on the activated Preview since W1. It needs `CLAIMANT_PORTAL_ALLOWED_ORIGINS`.
   - **Claim screen.** `runtime-bootstrap.ts` passes no runtime, so the claim screen is inert. A real runtime input is needed, and about 15 literal-false gates sit on the path (the runtime launch policy, bootstrap, foundation, hosted identity, native signing, session journey, portal client, bridge and handoff lifecycle).
   - **Signer.** The server verifies the handoff with the sheet-derived Ed25519 `proof_public_key`. The planned `native-signing-boundary` expects a hardware key and has no implementation. The signer must use the sheet key (the libsodium `seedKeyPair`), or the server design must change.
   - **Handoff routes.** `CLAIMANT_OFFLINE_CODE_V2_HANDOFF_ROUTES_APPROVED` has no Preview override. Case binding runs inside the handoff SQL.
2. **Sheet-check follow-ups from the phone run.** Confirm the `expo/fetch` adapter works on device. A wrong claimant origin or a badly wrong phone clock shows "can't be used" rather than "try again".
3. **Later:** W3 (next-of-kin invitation, evidence upload, dashboard, retrieval), the 7B reviewer console, and production readiness (W4–W5), as in the earlier close-out.

## Tooling notes

- **Supabase:** only read-only queries of system catalogs and the migration history are acceptable. The session's auto-approval blocks reading table rows on the production project.
- **Vercel:** the API occasionally resets connections; retry with `curl --retry 3 --retry-all-errors`.
- **Mobile tests:** `expo-constants`, `expo-crypto` and similar can't load in vitest. Use `vi.mock`, or the `.native.ts` split (see `claimant-preview-marker.native.ts`).
- **Size limits:** the Phase 1 check limits files to 500 lines and functions to 100 body lines, and it runs in `App security gates`.

## Next-session opener

> Continue the Sanduqkin claimant work in `shahbaz242630/Document-Vault`. Check out `claude/gifted-turing-lm2en4` and read `docs/handoff/2026-09-26-claimant-w1-w2a-session-close.md`, `CLAIM_HANDOFF.md`, and the W1 and W2 specs and verification records. Confirm `main` is at or after `eeb178e` (PR #104) and that `claimant-preview` equals `main`. Ask me whether the DNS record, the Preview app credentials, the build and the phone run are done. If they are, record the phone evidence and switch the API origin to `preview-api.sanduqkin.com`. Then write the W2b claim-start spec for my approval: claimant sign-in, the claimant portal session, the claim-screen runtime, the sheet-key handoff signer, and the handoff routes on Preview. Docs go with code; use a PR watcher that merges automatically when green.
