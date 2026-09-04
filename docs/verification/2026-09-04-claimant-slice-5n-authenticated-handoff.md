# Slice 5N — authenticated possession-to-case handoff verification

Date: 2026-09-04 (Asia/Dubai)

Status: complete locally, synthetic-only, literal-false, unmounted, unpushed, and undeployed. This is not production activation or identity/release authorization.

## Delivered boundary

- A forced-RLS server-only handoff record stores a two-minute transcript bound to the exact claimant, active portal session/version, verified possession challenge, server-selected case ID, expiry, record binding, and random nonce.
- The authenticated caller receives only opaque transcript bytes and possession-only flags. The caller cannot choose user, session, case, policy, owner, or downstream authority.
- Completion verifies a fresh non-recovery AAL2 session and an Ed25519 signature over the exact stored handoff bytes. The original anonymous possession-proof signature is invalid because the domain and bytes differ.
- The service-only security-invoker transaction revalidates eligibility, session freshness/version, proof recency, locator state and coherence under the established 5M lock order, then invokes 5M atomically.
- One draft case is created. Only an exact signature/key retry can replay inside the original expiry and current session. Identity, relationship, intake, review, and release remain false.
- Controller, service, transaction client, native signer, and production route remain disconnected. Both approval constants are literal false.

## Adversarial evidence

- Unit/controller coverage proves disabled-before-dependency behavior, strict request envelopes, exact origin/auth/content/size controls, no client-selected authority, safe headers, cross-account output rejection, malformed/expanded output rejection, stale/AAL1/recovery denial, real Ed25519 success, and old proof-domain signature rejection.
- Live SQL covers null/proof-shape rejection, cross-account load denial, stored-transcript stability, changed transcript and changed completion retry denial, exact replay, direct anonymous/authenticated denial, safe draft output, and exactly-once persistence.
- A genuine two-session database race consumes the same handoff concurrently; both exact calls settle safely and only one case exists.
- Full local HTTP → verified session adapter → handoff service → real Ed25519 verifier → PostgreSQL acceptance passes, including old-domain rejection, exact retry, and cross-account completion rejection.
- The security catalog explicitly tracks the new table and invoker RPC; forced RLS and service-only grants pass catalog and live RLS checks.

## Closing verification

- Two clean `supabase db reset --local --no-seed --workdir .` runs applied every migration through `20260903075258_claimant_offline_code_v2_authenticated_handoff.sql` from migration zero.
- Workspace tests: 1,274 passed; 3 established mobile skips.
- Script/security tests: 261 passed.
- All workspace TypeScript checks passed.
- ESLint passed with zero warnings while excluding only generated `supabase/.temp/**` and the protected unrelated `.codex-runtime/` and `.playwright-cli/` directories at invocation.
- Phase 1, repository security, GitHub Actions security, and production dependency guards passed. The bounded patched `image-size` exception remains unchanged through 2026-09-30.
- Slice 5M hostile/concurrent SQL, Slice 5N hostile/concurrent SQL, and Slice 5N real database acceptance passed after the final reset.
- Supabase catalog security and live RLS attack tests passed. `supabase db lint --local --level error --workdir .` returned zero errors.
- `git diff --check` passed. No hosted system, provider, deployment, native/EAS build, or real claimant data was touched.

The local database is disposable and currently contains the full integrated schema through 5N. Docker remains running because the owner asked to use it; no local stack shutdown was requested.
