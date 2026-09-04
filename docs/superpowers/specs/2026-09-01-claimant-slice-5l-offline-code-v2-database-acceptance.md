# Claimant Slice 5L — offline-code V2 database acceptance

Date: 2026-09-01 (Asia/Dubai)

Starting checkpoint: Slice 5K `1bc43c4`.

## Scope

Replace Slice 5K's final persistence double with the disposable local Supabase REST/RPC boundary. Connect the existing mobile lifecycle, proof producer, Hono controllers, boundary indexer, transaction decoder, and migrated PostgreSQL functions without mounting or enabling a production route.

The acceptance runner must refuse every non-loopback Supabase URL and require an explicit local-test flag. It may create only fixed synthetic rows in the disposable CI database. The local stack remains owned by the existing Supabase security job and is stopped after the job.

## Acceptance criteria

- A fixed synthetic locator is registered through the actual service-role RPC client, then the actual mobile lifecycle completes challenge and proof through in-process Hono requests and local PostgREST.
- A response lost after committed proof persistence is retried with identical proof bytes and idempotency key, produces one attempt fact, and returns possession-only authority.
- Concurrent duplicate registration exercises advisory locking and uniqueness: exactly one locator is committed and the rejected transaction leaves no partial event or idempotency fact.
- An expired locator is terminalized in PostgreSQL and receives only the availability-indistinguishable synthetic challenge shape, with no new persisted challenge for that locator.
- Six requests for one unknown locator exercise the migrated locator limiter; the sixth response is `429` with the bounded retry interval and no challenge fields.
- Anonymous access cannot read offline-code tables or execute the challenge/attempt RPCs. Service-role database results remain strict-decoded and cannot expand identity, claim, or release authority.
- Static guards prove the runner is local-only, synthetic-only, separately invoked, and registered after migrations in the existing live-security job.

## Exclusions and gates

This slice is disposable local-database evidence only. It does not authorize a hosted migration, hosted test mutation, runtime approval, route mount, material distribution, post-possession case binding, production KDF profile, native binding, physical-device claim, trusted-edge provider, MFA, deployment, or activation.

The runner does not claim network timing indistinguishability, multi-region rate-limit behavior, or production infrastructure correctness. Hosted and physical-device evidence remain separate gates. Every existing approval literal stays false.
