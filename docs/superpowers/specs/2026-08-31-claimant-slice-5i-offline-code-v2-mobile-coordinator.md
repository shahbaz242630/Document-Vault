# Claimant Slice 5I — isolated offline-code V2 mobile transport/coordinator

Date: 2026-08-31 (Asia/Dubai)

Starting checkpoint: Slice 5H `f8dce80`.

## Scope and authority

Connect the existing Slice 5F proof producer to the Slice 5E challenge/proof wire contract using injected synthetic adapters. Transport and coordinator each have an independent literal-false approval. No normal mobile, probe, web, shared barrel, or API runtime may import these modules. Test-only approval does not authorize a network call to a hosted service or approve production KDF parameters.

The caller supplies pre-provisioned synthetic locator, client secret, KDF profile, and public record binding. The challenge API intentionally does not discover owner/grant metadata. This increment does not design production distribution of that local material or post-possession case binding.

## Transport boundary

- Explicit injected HTTP adapter only; no global fetch fallback, token source, environment configuration, provider, native adapter, or storage.
- Exact distinct HTTPS API and claimant origins; only the two existing POST paths. The locator is submitted in the challenge body, never a URL. Only the challenge, canonical bytes, and public possession proof enter the proof body.
- Allowlisted headers, omitted credentials, no-store request, no redirects, and no-referrer policy. No client identity or trusted-edge input is accepted.
- Fifteen-second request/body deadline and a 16 KiB streamed UTF-8 response bound. Require JSON, exact claimant CORS origin, no-store, no redirect, consistent declared length, and exact response allowlists. Missing bounded streaming support fails closed; there is no unbounded text fallback.
- Validate exact canonical challenge bytes, frozen protocol/version, synthetic production-unapproved KDF, origin, cross-object proof fields, and possession-only result flags.
- Every exposed failure uses the same generic unavailable message. An internal retryable flag identifies ambiguous network/5xx/body-interruption failures without exposing response details. No automatic retry.

## Coordinator lifecycle

1. Reject disabled, concurrent, non-synthetic, invalid-material, invalid-idempotency, or reused cross-operation idempotency inputs before adapters run.
2. Copy and freeze local material before the first asynchronous boundary.
3. Obtain and revalidate an issued challenge, requiring exact local KDF equality, matching public record fields, and current challenge time. The existing producer cryptographically verifies the local locator, record digest, and proof key.
4. Produce proof locally. Recheck expiry/cancellation and validate all producer output before submission.
5. Return only an immutable possession result, with identity verification, claim creation, and release authorization fixed false.

Only an ambiguous proof-delivery failure retains pending state. That state contains the exact public proof request and its original idempotency key, never the client secret, local owner/grant record, or derived keys. An explicit retry uses identical bytes, runs no new KDF, and is limited to three total proof sends. Cancellation, definite rejection, invalid output, expiry, success, or exhausted retries clears it. An expiry timer also clears idle pending state. The coordinator checks nondecreasing time and expiry around asynchronous work and suppresses late success after cancellation.

Cancellation cannot interrupt synchronous native KDF work already running. The active attempt remains occupied until the producer settles, allowing the existing producer's buffer cleanup to finish before another attempt. JavaScript strings and caller-owned input are not claimed to be zeroizable. There is no persistence or reload recovery; the server independently expires challenges and possession never grants release.

## Validation and rollback

Hostile tests cover default denial, exact request allowlists, actual frozen Argon2id/HKDF/Ed25519 proof production with independent Node signature verification, canonical-byte/record/origin/KDF/proof substitution, authority escalation, malformed/oversized responses, hung adapters, cancellation, late results, concurrent starts, immutable snapshots, clock rollback, expiry, and bounded identical replay. This is local synthetic client/wire-contract coverage, not a hosted or database end-to-end run.

An AST-assisted isolation guard and mutation tests enforce both literal-false approvals, injected-only HTTP, no runtime storage/identity/provider/native imports, and no imports or re-exports outside these two modules and tests. Register the guard in Security CI without changing existing checks.

Rollback removes these isolated modules, their tests, guard, CI/package registration, and related documentation. No migration, external state, normal route, app identity, build configuration, or production deployment requires rollback.

## Separate gates

Production KDF choice and representative-device evidence; EAS dispatch/device execution; production native transport/crypto/lifecycle binding; secure material entry/distribution; trusted-edge signals; post-possession case binding; hosted MFA; providers; deployment; real data; and runtime activation remain unapproved by this increment. No existing approval is changed.
