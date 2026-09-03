# Claimant Slice 2E — Concealed Upload Controller And Synthetic Adapters

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2E controller increment is code-complete on `codex/claimant-upload-controller`. Capability issue, raw upload, and reconciliation paths are mounted only behind `CLAIMANT_UPLOAD_CONTROLLER_APPROVED = false`; normal requests receive `404` before configuration, CORS, authentication clients, transaction clients, or upload adapters are touched. No real evidence, provider adapter, hosted configuration, hosted migration, deployment, or external claimant behavior was added.

## Implemented boundary

- Capability issue, `PUT` streaming upload, and explicit reconciliation use separate operation-specific methods, exact CORS header sets, strict UUIDv4 idempotency, and bounded JSON schemas where applicable.
- The configured API origin and claimant portal origin must each be one exact canonical HTTPS origin. A mismatch is concealed as not found.
- Claimant identity and session ID come only from verified bearer state. Every operation requires unexpired fresh AAL2 without recovery authentication and re-asserts the active claimant-portal session before transaction authority is created.
- Upload requires an allowlisted exact content type, a canonical positive `Content-Length` no greater than 25 MiB, a route-bound case/object UUID pair, and a 256-bit Base64URL capability. The request body remains a stream; the controller does not call `arrayBuffer()` or `formData()`.
- Before Storage receives a byte, the processor hashes the capability and asks service-only database authority to confirm exact case, object, path, media type, expected byte count, issued state, and upload-pending authority. Recorded objects follow authoritative replay/reconciliation instead of being overwritten.
- One client idempotency UUID is expanded through a server-keyed domain-separated HMAC into separate quarantine, scan, and cleanup UUIDs. Capability replay identity excludes controller wall-clock expiry, so a later exact retry returns the original database-authoritative expiry instead of becoming changed input. The service processor actor comes from server configuration, not claimant input.
- A bounded in-process claimant/case guard rejects overlapping operations with generic `429` plus `Retry-After: 1`. This is a local resource guard only; distributed per-account and per-network edge throttling remains a launch gate.
- Responses use no-store/nosniff and generic failure classes. Provider messages, filenames, content bytes, raw capabilities, digests, and internal exception detail are not emitted or logged.
- The deterministic local Storage/inspector/scanner composition accepts only exact predeclared synthetic bytes and expected media. It is independently immutable-false by default, contains no provider dependency, and is statically prohibited from the API entrypoint.

## Immutable gates and limitations

- `CLAIMANT_UPLOAD_CONTROLLER_APPROVED = false`.
- `CLAIMANT_UPLOAD_PROCESSOR_APPROVED = false`.
- `CLAIMANT_SYNTHETIC_UPLOAD_ADAPTERS_APPROVED = false`.
- The claimant `evidenceUpload` runtime capability remains false and production activation remains absolutely locked.
- No production parser, malware scanner, Storage provider, callback, regional-processing choice, DPA/subprocessor approval, backup/restore proof, distributed concurrency, per-network abuse control, observability, or operational runbook exists.
- The provisional synthetic 30-day delete-after value is not legal/privacy retention approval.
- Existing local claimant and Storage migrations remain undeployed. The existing owner-vault API deployment was not changed.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 939 passed; 3 environment-gated mobile tests skipped.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- Focused controller/processor suite: 19 passed across 2 files.
- `npm run check:claimant-upload-controller-isolation`: passed.
- `npm run check:claimant-private-quarantine-db`: passed against the rollback-only local database exercise.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:github-actions-security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- `git diff --check`: passed.

Hostile coverage includes disabled-before-config behavior, wrong API and portal origins, stale assurance, active-session assertion, database authority before Storage, declared/server size mismatch before bytes, generic provider failure, bounded contention, exact preflight headers, later wall-clock capability replay, capability reconciliation, immutable-false synthetic adapters, exact-fixture rejection, stream overflow/inspection failure, ambiguous commit preservation, authoritative orphan cleanup, and scanner fail-closed behavior.

## Next bounded slice

Add a hard-disabled claimant evidence-upload client coordinator using synthetic fixtures and an injected transport. Bind prepared placeholder to capability issue, raw upload, and reconciliation; provide cancellation, bounded progress, retry/reload-safe reconciliation state, and no browser persistence of bytes or capabilities. Real browser file selection, real provider configuration, distributed edge controls, deployment, and external access remain separate gates.

## Staging observation and production rollback

On 2026-08-12, preview deployment `dpl_C2i433SvMQvYwRfe8Z9AQC4bTTER` completed its Vercel build and reported `Ready`, but every invocation returned `500 FUNCTION_INVOCATION_FAILED`, including `/health`. Function logs identified the exact startup failure: `/var/task/node_modules/@vault/shared-types/src/index.ts` was absent when imported by `native-enrollment-routes.js`. No Slice 2E route logic ran.

The production alias independently resolved to a three-hour-old deployment with the same failure. With explicit owner approval, production was rolled back to the previously verified deployment `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`. Post-rollback checks passed twice for `/health` with `200`, `no-store`, same-origin resource policy, and `nosniff`; unauthenticated account deletion returned `401`; claimant upload remained absent with `404`.

The package boundary was then corrected: `@vault/shared-types` now publishes source declarations and React Native/development resolution separately from a bundled Node ESM runtime entry. The root install builds that distribution deterministically with pinned TypeScript and esbuild. `check:api-vercel-bundle` verifies the exact Vercel function handler, workspace mapping, copied manifest, referenced runtime file, and a real Node import of that packaged entry.

Fresh preview `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro` (`https://sanduqkin-fmur0lenk-shahbaz-ali-maliks-projects.vercel.app`) built without cache and remained `target: preview`. It passed two `/health` requests with `200` and the expected no-store/same-origin/nosniff headers; disabled capability issue `POST`, raw upload `PUT`, reconciliation `POST`, preflight `OPTIONS`, and hostile-origin issue all returned the intended generic `404`; unauthenticated account deletion returned `401`; unknown route returned `404`. Preview audit retention returned the expected configured-safe `503` because its internal token is intentionally absent in Preview. Ten runtime log entries contained no warning, error, exception, or startup failure. Production remained healthy on the rollback deployment and was not promoted or changed.

After the packaging fix, the complete local regression passed: 940 tests with 3 environment-gated mobile skips, every workspace typecheck, lint with zero warnings, Phase 1/security/GitHub Actions/custody/upload-isolation guards, the Vercel bundle/import guard, the rollback-only private-quarantine database exercise, and `git diff --check`.
