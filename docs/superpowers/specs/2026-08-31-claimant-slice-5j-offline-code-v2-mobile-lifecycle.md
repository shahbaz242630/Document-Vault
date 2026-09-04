# Claimant Slice 5J — isolated offline-code V2 lifecycle composition

Date: 2026-08-31 (Asia/Dubai)

Starting checkpoint: Slice 5I `60a8601`.

## Scope

Compose the existing Slice 5I transport/coordinator with an explicitly supplied proof producer and dedicated synthetic claimant lifecycle source. This closes the missing link between host lifecycle changes and the cancellation/retry cleanup already implemented in 5I. It does not add an app entry point, UI, native event binding, production crypto/HTTP adapter, or authenticated session implementation.

The independent `CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED` constant remains literal false. Only explicit test approval plus `syntheticOnly: true` and `productionRuntime: false` permits composition. Disabled creation reads no configuration, adapter, or lifecycle dependency. The 5I transport and coordinator default approvals remain unchanged; the isolated root supplies test approval only inside its own guarded construction branch.

## Lifecycle contract

An injected source subscribes to the dedicated synthetic claimant scope, emits the current state synchronously, and returns a cleanup function. It must not silently inherit owner-session authority. Events contain exactly a bounded integer sequence and one of `foreground`, `inactive`, `background`, `locked`, `session_ended`, or `disabled`.

- Work requires an initialized, open, foreground scope with no other operation in progress.
- Identical replay of the latest event is harmless. Sequence rollback, same-sequence divergence, malformed or extra fields, missing initial state, or subscription failure closes the scope.
- Inactive/background events invalidate the current attempt, cancel HTTP work, clear pending proof retries, and suppress late results. Foreground restoration never automatically restarts or retries work.
- Lock, session end, kill switch, or disposal permanently closes the instance. A subsequent foreground event cannot revive it. A future host must explicitly create a new eligible scope; this slice supplies no authentication or eligibility authority.
- An operation-generation check prevents a background/foreground round trip from accepting an earlier successful response.
- Cleanup detaches the subscription once and redacts cleanup failures. A source that throws before returning its cleanup function must own rollback of its subscription; the retained callback still fails closed.

Disposal closes the scope synchronously and returns a value-free promise that settles only when the in-flight operation has settled. It is safe under reentrant shutdown and repeated disposal. It does not interrupt a synchronous KDF or promise that a defective injected producer will settle. Until the producer finishes, another operation is prohibited. JavaScript strings and caller-owned input are not claimed to be zeroizable.

## Public surface

The root exposes explicit start, explicit proof retry, cancellation, disposal, and an immutable value-free snapshot. Snapshot states are `disabled`, `ready`, `working`, `unavailable`, `completed`, `suspended`, and `closed`. Identity verification, claim creation, and release authorization are always false. `completed` is only a local display fact, not an access credential, persisted proof, or authorization decision. Background and closure remove that display state.

The async operation may return the existing possession-only result. No challenge, proof, client secret, record binding, owner/grant identifier, or adapter error is retained in the snapshot. There are no observer callbacks carrying sensitive data, storage writes, telemetry, provider calls, or automatic network actions from lifecycle events.

## Verification and isolation

Use synthetic fixture adapters, actual frozen proof production, and hostile lifecycle/network/producer scheduling to test initialization, malformed events, monotonic sequencing, concurrent actions, interrupted issuance/derivation/submission, foreground restoration, exact proof retry, replay invalidation, terminal shutdown, reentrant/awaitable disposal, dependency rebinding, and result redaction.

The 5I isolation guard permits exactly this new composition file only after validating its own literal-false approval and safety checks. Both guards reject normal app/probe/web/API/barrel imports, native/provider/storage/global networking, dynamic adapters, and removed lifecycle constraints. Mutation tests cover the exception itself. No broad feature-folder exception is added.

## Separate gates and rollback

Production native lifecycle/HTTP/crypto binding, secure material entry/distribution, representative KDF evidence/approval, post-possession case binding, trusted-edge signals, hosted MFA, external builds, providers, deployment, real data, and activation retain their separate gates. This slice makes no decision on those gates.

Rollback removes the isolated root, tests, guard, exact 5I import exception, CI/package registration, and documentation. It requires no database, deployment, app-profile, or hosted-state rollback.
