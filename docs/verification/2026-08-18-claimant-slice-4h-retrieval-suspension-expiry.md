# Claimant Slice 4H — retrieval suspension and expiry

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-retrieval-suspension-expiry`

Starting checkpoint: `83d1452` (`Add claimant retrieval completion foundation`)

## Outcome

Slice 4H adds an immutable-false, unmounted service boundary and one locked service-only transaction for ending future release-package access through a current synthetic suspension or recorded package expiry.

- The transaction serializes against retrieval-session authorization, package-delivery preparation/commit, and retrieval completion before choosing the truthful terminal access state.
- A suspension is accepted only while the package finalization is current and unexpired. An expiry record is accepted only after the database-owned finalization deadline has passed. Both require the exact current release-ready or released case version.
- Finalization status becomes `suspended` or `expired`, so existing authorization and delivery-preparation functions reject future work without being rewritten.
- Every current retrieval session loses package-serving authority. Unserved sessions become `access_ended_unserved`; served incomplete sessions become `access_ended_served_unrecalled`; completed sessions become `access_ended_completed_unrecalled`.
- Prepared unserved deliveries become inaccessible. Served deliveries remain served with their receipt and completion truth preserved, but become `access_ended_served_unrecalled`. The migration never resets `package_served` or `retrieval_completed`.
- Three forced-RLS server-only tables persist the access control, one value-free event, and stable idempotency. Explicit client denial, narrow service grants, constraints, and foreign-key/query indexes are included.
- Results and persisted controls fix future serving and retrieval authorization to false. They also fix local-content recall and deletion to false, because the server cannot truthfully claim that already delivered or opened local data was recalled or erased.
- The case remains `release_ready` or `released` at the same version. Existing completion rows, export state, and closure state are not updated.

No API route, app entrypoint, production native implementation/binding, browser plaintext, server decryption, public or signed URL, hosted migration, deployment, real data, Supabase image download, export, closure, or external behavior was added.

## Verification

- New API tests: 7 passed, covering the immutable-false default, exact suspension/expiry reason pairs, strict request parsing, safe error reduction, RPC mapping, response substitution, immutable recall/deletion/future-authority flags, and served-before-completed coherence.
- New migration/isolation checks: 7 passed.
- Two standalone PostgreSQL rollback scenarios passed against the already-cached `postgres:16-alpine` image:
  - Served suspension preserved the released case, delivery receipt, served truth, incomplete truth, and App Attest counter; blocked a valid later completion proof; returned stable replay; and denied authenticated table/function access.
  - Recorded expiry preserved the release-ready case, terminally ended the unserved session, created no delivery, and blocked package-delivery preparation.
- The temporary PostgreSQL container was removed after verification.
- Workspace tests: 1,083 passed; 3 established environment-gated mobile tests skipped.
- Full static/security regressions: 196 passed serially.
- All workspace typechecks, zero-warning lint, production web build, API bundle check, claimant custody isolation, retrieval-access-control isolation, and `git diff --check` passed.

## Remaining gates

The Slice 4H approval remains immutable false, and neither the service nor transaction client is imported by the API entrypoint. No scheduler, HTTP controller, production operator authority, hosted migration, native implementation, or device evidence exists.

Suspension and expiry prevent future server authority; they do not recall, remotely erase, or prove deletion of any data already delivered or opened locally. Delivery, native open, retrieval completion, optional local export, claimant confirmation, and closure remain separate facts.

The next bounded slice is Phase 4 Slice 4I: an immutable-false, runtime-disconnected native local-export contract requiring explicit claimant action and exact completed local-open authority. Plaintext must remain inside the native boundary; JavaScript and the server receive only a value-free export receipt, and closure remains false.
