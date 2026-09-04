# Claimant Slice 5F — offline-code V2 client proof and benchmark harness

Date: 2026-08-30 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-client-proof`

Starting checkpoint: `2930b20` (`Run latest offline-code isolation guards in CI`)

## Outcome

Slice 5F adds a hard-disabled, runtime-disconnected mobile proof producer for the frozen offline-code V2 protocol. The client validates the checksummed split locator/client secret, the synthetic-only KDF profile, complete locator and record bindings, exact HTTPS origin, challenge issue/expiry window, and every proof-key/challenge cross-binding before producing an Ed25519 signature.

The producer reproduces the frozen Argon2id root, domain-separated HKDF-SHA256 proof seed, Ed25519 public key, record-binding digest, challenge transcript, and possession proof byte-for-byte. Derived root, seed, and private-key buffers are wiped after success or failure. The output asserts only `route_possession_only`; it contains no identity, claim, evidence, grant, release, or retrieval authority.

Platform adapters use `libsodium-wrappers-sumo` for test/web-compatible execution and the existing `react-native-libsodium` JSI package plus Expo SHA-256 on native. There is no transport, UI, storage, Supabase/provider access, authorization/cookie input, native key persistence, trusted-edge adapter, post-possession binding, or normal runtime import.

The same boundary includes a bounded 1-10 sample KDF benchmark harness. Reports contain only bounded device/runtime classification and timing values, remain `synthetic_only: true`, and always emit `production_approved: false`. A five-sample desktop reference run for the frozen 64 MiB/opslimit-2 profile measured 116.38, 98.51, 86.11, 86.27, and 80.65 ms (median 86.27 ms; p95 116.38 ms). This is not representative physical-device evidence and does not approve production parameters.

`CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED` remains literal `false`. A dedicated CI isolation guard prevents network, storage, provider, identity-header, or production-approval behavior and rejects imports by normal mobile runtime.

## Verification

- New client proof/benchmark tests: 4 passed, including exact vector reproduction and hostile origin, expiry, locator, record, and proof-key substitutions.
- All workspaces: 1,135 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks and zero-warning lint passed.
- Unchanged web production build generated 24 pages successfully.
- API Vercel bundle, repository security, mobile secret, GitHub Actions security, deterministic claim vectors, vector isolation, custody isolation, base V2 isolation, and Slice 5F isolation checks passed.
- `git diff --check` passed.

## Open boundary

Representative physical iOS and Android benchmark evidence, production KDF parameter selection/security review, native compile/device execution, client transport/coordinator integration, secure entry and lifecycle handling, trusted-edge signals/distributed limiting, durable post-possession case binding, identity decisions, and external activation remain open. The controller and every prior claimant approval remain false.
