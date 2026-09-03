# Claimant Slice 4A — release authorization foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-release-authorization-foundation`

Starting checkpoint: `bc61110` (`Add claimant review escalation foundation`)

## Outcome

Slice 4A adds an immutable-false, unmounted, service-only release-eligibility and final-
authorization boundary using synthetic authority and data.

- Four forced-RLS tables persist separate release-authority identities, append-only final
  authorizations, immutable value-free events, and idempotency results with explicit client denial.
- The final authorizer is synthetic-only, has no live authority, and cannot overlap the owner,
  claimant, any reviewer identity, or any escalation/appeal resolution identity.
- One locked transaction binds the exact case, owner-protection cycle, two-person review round,
  case/round/binding/finalization/submission versions, policy pack, authority identity, and
  idempotency key.
- It revalidates expired cooldown, verified owner notice, current owner finalization, the exact
  two-allow aggregate, both current reviewer assignments/identities, and the absence of every
  intervention record for the case.
- It requires at least two active claimant device keys, including the current key, and exactly
  matching active owner-created recipient grants at the current key versions. Missing, extra,
  revoked, stale-version, or cross-party authority fails closed.
- The only state transition is `cooldown` to `approved` with one case-version increment. The new
  immutable record marks release authorization true while package creation and retrieval authority
  remain explicitly false.
- Foreign-key and operational lookup paths have explicit indexes. The database function is
  security-invoker, callable only by `service_role`, and returns no reviewer, reason, key, grant,
  evidence, or private-material detail.

No HTTP route, UI, ciphertext, package, signed URL, retrieval session, native behavior, provider,
hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL rollback exercise passed against the already-cached generic
  `postgres:16-alpine` image. It covered missing recipient grants, open intervention, suspended
  reviewer, owner-authorizer overlap, stale round version, stable/changed replay, exact atomic
  records, the single state transition, package/retrieval denial, and authenticated table/RPC denial.
- The exact temporary container `sanduqkin-slice4a-postgres` was removed after testing. No Supabase
  image was downloaded or started, and hosted Supabase was not contacted or changed.
- Workspace tests: 1,027 passed; 3 established environment-gated mobile tests skipped.
- Release-authorization API tests: 6 passed.
- Full static/security regressions: 148 passed serially.
- All workspace typechecks and zero-warning lint passed.
- Production web build passed with 24 static pages.
- API Vercel bundle, claimant custody/isolation, dedicated release-authorization isolation, and
  `git diff --check` passed.

## Remaining gates

The release-authorization service approval remains immutable false and unmounted. No package or
retrieval authority exists. The next bounded slice is Phase 4 Slice 4B: claimant-addressed encrypted
package validation and persistence using synthetic owner-client-sealed ciphertext, bound to the
exact current authorization and recipient grants. It must remain unmounted and add no server-side
encryption/decryption, retrieval session, native opening/export, provider, deployment, real data, or
external behavior.
