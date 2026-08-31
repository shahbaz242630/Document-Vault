# Claimant Slice 5K — offline-code V2 integration acceptance

Date: 2026-08-31 (Asia/Dubai)

Starting checkpoint: Slice 5J `5b0fcdb`.

## Scope

Connect the existing mobile lifecycle, coordinator, transport, and platform proof producer to the actual Hono controllers, server verifier, and persistence transaction decoder inside one process. Use the frozen synthetic fixture and replace only the database RPC with a test double. This closes the local cross-layer compatibility gap left by separate mobile and API tests; it does not add a runtime capability.

The injected HTTP sender calls Hono directly. Global fetch is trapped and asserted unused; no external API or database request is needed. Use real Argon2id/HKDF/Ed25519 proof production and server verification. Reuse the mobile adapter's existing ambient declaration for API-workspace typechecking without widening production imports or weakening types.

## Acceptance criteria

- Default mounted routes stay concealed and disabled composition performs no configuration or persistence work.
- An explicitly enabled synthetic test flow produces only route-possession authority. Client secrets do not enter HTTP or RPC inputs; identity, claim, and release flags stay false.
- Lost responses after synthetic persistence permit only bounded, identical public-proof retries with stable idempotency and no repeated KDF work.
- Lifecycle cancellation after server acceptance suppresses local success and destroys retry eligibility; it cannot undo a server fact already recorded.
- Inactive state or expired challenge prevents proof production. Missing trusted-edge signals and kill switches fail before persistence.
- Invalid signatures, substituted bindings, hostile headers/origins/bodies, rate-limit responses, RPC errors, and malformed RPC output fail closed.
- Existing production isolation checks remain unchanged and pass. The new test is covered by the existing workspace CI test discovery and a dedicated local command.

## Exclusions and gates

The RPC double provides fixture responses and replay bookkeeping only. It does not establish PostgreSQL locking, uniqueness, expiry, rollback, RLS, or distributed rate-limit correctness. Existing SQL evidence remains separate. The unavailable-record fixture checks response compatibility and local failure behavior, not timing indistinguishability or hosted record concealment.

No production code, approval literal, migration, native adapter, KDF profile, material distribution, case binding, hosted MFA, external provider, build, deployment, or activation changes belong to this slice. Native device behavior, real transport cancellation, trusted-edge adaptation, hosted transactions, and independent review remain separate evidence gates.
