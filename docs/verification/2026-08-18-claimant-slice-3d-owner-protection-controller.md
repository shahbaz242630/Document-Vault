# Claimant Slice 3D — owner response controller

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-owner-response-controller`

Starting checkpoint: `f8d6211` (`Add owner notice delivery queue`)

## Outcome

Slice 3D is committed at the session-closing branch HEAD. It mounts independently concealed owner-cancellation and claimant-dispute HTTP boundaries over Slice 3A's stop transaction:

- `POST /owner/cases/:caseId/protection/cancel`
- `POST /claimant/cases/:caseId/protection/dispute`

The controller approval remains a literal `false`, and the existing `ownerProtection` runtime capability is also required. Disabled requests return `404` before configuration, CORS, authentication, session-client creation, or transaction authority.

## Security boundary

- Exact, distinct HTTPS API, owner, and claimant origins are mandatory.
- The owner route constructs only registered-recipient session authority; the claimant route constructs only claimant-portal session authority.
- Bearer identity and session IDs are server-derived from verified Supabase user and JWT claims, then cross-bound to the appropriate active-session assertion.
- Both actions require fresh AAL2 without recovery authentication.
- Actor, reason, and action are not accepted from the body. The controller supplies `owner_cancelled` or `claimant_dispute` from the selected route.
- UUIDv4 case/cycle/idempotency values, exact JSON, a 4 KiB body limit, strict preflight headers, and bounded actor/action/case concurrency fail closed.
- Database role/case denial maps to `404`; stale-version and serialization contention return a generic `409`; internal detail is never returned.
- The safe response preserves `review_started: false` and `release_authorized: false`.

No provider, notification, reviewer, release predicate, UI activation, hosted database change, deployment, or external access was added.

## Verification

- Focused controller tests: 9 passed.
- Workspace tests: 1,003 passed; 3 established mobile tests skipped.
- Static security regression suite: 117 passed.
- Workspace typecheck: passed.
- ESLint with zero warnings: passed.
- API Vercel bundle check: passed.
- Production web build: passed; 24 static pages generated.
- Owner-protection controller isolation guard and its regression test: passed.
- Docker image inventory: no Supabase image is present.

One stale Slice 2B static assertion was narrowed from prohibiting every `/claimant/evidence` route to prohibiting the evidence-preparation service/RPC itself. This preserves Slice 2B's unmounted boundary while recognizing the independently concealed Slice 2E upload controller already mounted on those paths.

## Remaining gates

All claimant and owner-protection approvals remain immutable false. Hosted MFA, provider selection and assurance, distributed edge abuse controls, operations and incident evidence, legal/privacy approval, deployment review, and external activation remain open. The next bounded slice is a default-deny, unmounted reviewer assignment/conflict/recusal persistence foundation; it must not add a release predicate.

The interim engineering test team is Shahbaz Malik as accountable human test reviewer and Codex as a non-human technical test actor. This does not satisfy either live human approval. The hourly claimant heartbeat was deleted at session close, so no monitoring remains active.
