# Claimant Slice 3F — independent review foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-independent-review-foundation`

Starting checkpoint: `f5a9728` (`Add claimant reviewer assignment foundation`)

## Outcome

Slice 3F adds an immutable-false, unmounted, service-only persistence boundary for two independent
synthetic review decisions and their aggregate outcome.

- Four forced-RLS tables persist review rounds, append-only decisions, immutable value-free events,
  and idempotency records with explicit client denial.
- Each decision binds to the exact active reviewer assignment, reviewer identity, case, owner-
  protection cycle, submission receipt, intake/preparation versions, policy pack, checklist digest,
  and clean-evidence manifest digest.
- Checklist and evidence digests are recomputed by the server. Clean evidence object versions and
  content digests are included, and the clean-object count must match the immutable submission
  receipt.
- The first decision returns only a pending aggregate. The second returns only the aggregate final
  status, never the other reviewer identity, decision, or reason.
- Unique slot, assignment, and reviewer constraints prevent duplicate or same-reviewer decisions.
- Before completion, every prior assignment and synthetic reviewer identity is revalidated so a
  recusal, conflict, suspension, version change, or live-authority drift invalidates the round.
- Exactly two `allow` decisions produce `two_person_approved`. Reject and hold aggregates remain
  non-release outcomes. The case row is not advanced and `release_authorized` remains false.

No route, reviewer UI, evidence-content access, signed URL, provider, escalation, appeal, package,
hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL rollback exercise passed without downloading Supabase images. It covered
  first-decision blindness, stable and changed-input replay, duplicate reviewer denial, stale
  checklist denial, stale-first-assignment invalidation, two-distinct-reviewer approval, immutable
  decision/event counts, unchanged case state, and authenticated-role denial.
- Direct linked Supabase discovery was attempted read-only and rejected by platform access control
  with HTTP 403. No hosted SQL, migration, or state change occurred.
- Workspace tests: 1,015 passed; 3 established environment-gated mobile tests skipped.
- Independent-review API tests: 6 passed.
- Full static/security regressions: 135 passed serially.
- All workspace typechecks and zero-warning lint passed.
- Production web build passed with 24 static pages.
- API Vercel bundle, claimant custody/isolation, and `git diff --check` passed.
- The temporary generic PostgreSQL container was removed after testing. No Supabase images were
  downloaded and hosted Supabase was unchanged.

## Remaining gates

All claimant, owner-protection, reviewer-assignment, and review approvals remain immutable false.
The next bounded slice is Slice 3G: service-only escalation and appeal persistence with explicit
hold behavior, separate authority, immutable reasons/events, and invalidation of any prior review
aggregate. It must remain unmounted and add no reviewer UI, evidence access, package creation,
release predicate, deployment, real data, or external behavior.
