# Claimant Slice 3G — review escalation and appeal foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-review-escalation-foundation`

Starting checkpoint: `7bb6862` (`Add claimant independent review foundation`)

## Outcome

Slice 3G adds an immutable-false, unmounted, service-only persistence boundary for synthetic review
escalations and appeals.

- Four forced-RLS tables persist separate resolution-authority identities, append-only open
  interventions, immutable value-free events, and idempotency records with explicit client denial.
- Resolution identities are synthetic-only and have no live authority. Their user cannot be the
  case owner, claimant, or any reviewer identity; the required authority class is distinct for an
  escalation and an appeal.
- The locked transaction binds the exact case, owner-protection cycle, review round, case version,
  round version, authority identity, intervention type, reason class, and idempotency key.
- Escalation can stop any current review aggregate. Appeal requires a rejected or held round.
- Opening either intervention atomically forces the review round to `held`, clears any prior
  two-person approval, increments the round version, and keeps release authorization false.
- The case remains in `cooldown`. There is no intervention-resolution mutation, release predicate,
  or path that advances the case.
- Results expose only the held aggregate and open intervention identifiers/status; authority
  identity, safe reason, reviewer identities, decisions, and evidence details are not returned.

No route, reviewer UI, evidence access, signed URL, provider, package, release authorization,
resolution operation, hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL rollback exercise passed against the already-cached generic
  `postgres:16-alpine` image. It covered approval invalidation, rejected-round appeal, stable and
  changed-input replay, duplicate intervention denial, authority-class mismatch, owner-authority
  denial, immutable records/events, unchanged case state, and authenticated table/RPC denial.
- The exact temporary container `sanduqkin-slice3g-postgres` was removed after testing. No Supabase
  image was downloaded or started, and hosted Supabase was not contacted or changed.
- Workspace tests: 1,021 passed; 3 established environment-gated mobile tests skipped.
- Review-intervention API tests: 6 passed.
- Full static/security regressions: 141 passed serially.
- All workspace typechecks and zero-warning lint passed.
- Production web build passed with 24 static pages.
- API Vercel bundle, claimant custody/isolation, dedicated intervention isolation, and
  `git diff --check` passed.

## Remaining gates

All claimant, owner-protection, reviewer, review, intervention, and release approvals remain
immutable false. The next bounded slice is Phase 4 Slice 4A: a separately reviewed service-only
release-eligibility and final-authorization foundation that revalidates every current prerequisite
and fails closed on an open intervention. It must remain unmounted and create no package, ciphertext,
retrieval session, native behavior, deployment, real data, or external behavior.
