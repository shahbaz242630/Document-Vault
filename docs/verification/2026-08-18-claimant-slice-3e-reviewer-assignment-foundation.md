# Claimant Slice 3E — reviewer assignment foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-reviewer-assignment-foundation`

Starting checkpoint: `9089497` (`Add concealed owner response controller`)

## Outcome

Slice 3E adds an immutable-false, unmounted, service-only persistence boundary for synthetic
reviewer identities, case assignments, declared conflicts, and recusals.

- Four public-schema tables use forced RLS, explicit `anon`/`authenticated` denial, and narrow
  `service_role` grants.
- Reviewer identities are pseudonymous, synthetic-only, and structurally prohibited from holding
  live review authority.
- Two assignment slots require distinct active reviewer identities. A reviewer whose user identity
  is the case owner or claimant is denied.
- Assignment requires the exact current case and owner-protection cycle, verified notice delivery,
  and an expired cooldown. Cross-case and stale bindings fail closed.
- Conflict and recusal terminate only the exact current assignment version. The vacated slot can be
  reassigned to a different eligible synthetic reviewer.
- Every mutation is advisory-lock serialized, request-digest idempotent, and records an immutable,
  value-free event.
- All responses explicitly preserve `reviewer_decision_recorded: false`,
  `approval_counted: false`, and `release_authorized: false`.

The service approval is a literal `false`, and neither the service nor transaction client is
imported by the API entrypoint. No route, reviewer UI, evidence access, decision, approval count,
release predicate, provider, hosted migration, deployment, or external behavior was added.

## Interim test identities

The schema can model Shahbaz Malik as the accountable human test reviewer and Codex as a non-human
technical test actor using separate synthetic identities. Those identities have no live authority,
cannot satisfy the two-independent-human control, and must be removed or disabled before external
claimant access or real data.

## Verification

- Disposable local Supabase reset applied all 30 migrations through Slice 3E successfully.
- The rollback-only hostile database exercise passed, covering two distinct slots, duplicate
  reviewer/slot denial, owner/claimant related-party denial, cross-case substitution, stale
  assignment versions, changed-input replay, conflict, recusal, safe reassignment, atomic record
  counts, and authenticated-role table/function denial.
- Workspace tests: 1,009 passed; 3 established environment-gated mobile tests skipped.
- Reviewer-assignment API tests: 6 passed.
- Full static/security regressions: 129 passed serially. The two bounded `image-size` parser tests
  also passed independently after a resource-contention timeout in the initial fully parallel run.
- All workspace typechecks passed.
- ESLint passed with zero warnings.
- Production web build passed with 24 static pages.
- API Vercel bundle and claimant custody/isolation checks passed.
- `git diff --check` passed.
- The disposable Supabase stack, containers, volumes, and downloaded Supabase images were removed
  after testing. Hosted Supabase was not contacted or changed.

## Remaining gates

All claimant, owner-protection, and reviewer approvals remain immutable false. The next bounded
slice is Slice 3F: independent review-decision persistence and two-person approval enforcement. It
must bind decisions to current assignments and immutable evidence/policy versions, prevent a
reviewer from seeing or duplicating the other decision where required, and keep every release
predicate false and unmounted. Reviewer UI, evidence access, escalation/appeal, package creation,
deployment, real data, and external behavior remain out of scope until separately authorized.
