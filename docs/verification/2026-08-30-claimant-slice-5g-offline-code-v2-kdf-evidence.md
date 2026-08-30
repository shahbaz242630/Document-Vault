# Claimant Slice 5G — offline-code V2 physical KDF evidence boundary

Date: 2026-08-30 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-kdf-evidence`

Starting checkpoint: `993bc84` (`Add offline-code V2 client proof producer`)

## Outcome

Slice 5G adds a hard-disabled, runtime-disconnected evidence runner around the Slice 5F KDF benchmark harness. It has no application entry point and fails before benchmark execution unless an exact non-production probe profile confirms an operator-controlled physical iOS or Android baseline device, synthetic material, nominal thermal state, disabled low-power mode, value-free capture, and exactly five samples.

Benchmark output is treated as untrusted runtime data. Exact top-level and nested device keys are required. The runner rejects simulator/desktop classification, platform mismatch, non-native crypto, changed profile/protocol/purpose, production approval, extra or missing fields, invalid sample counts/timings, and inconsistent median/p95 calculations. Runner failures are redacted.

Successful evidence is deliberately classified only as `measured`. The value-free report retains run/build/profile/platform/device-tier/timestamp/sample-count/median/p95 facts, always says `synthetic_only: true` and `production_approved: false`, and omits model, OS version, individual durations, secret, salt, root, proof, and native error details. Invalid evidence has null metrics and zero samples.

`CLAIMANT_OFFLINE_CODE_V2_KDF_EVIDENCE_ENTRY_ENABLED` remains literal `false`. A dedicated CI isolation guard prohibits network, provider, storage, identity-header, production-approval, production-ready, or normal-runtime wiring.

No physical device benchmark, probe build, production KDF selection, native build, UI, transport, storage, hosted mutation, trusted-edge adapter, deployment, or external activation was performed.

## Verification

- New physical KDF evidence tests: 5 passed.
- All workspaces: 1,140 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks and zero-warning lint passed.
- Unchanged web production build generated 24 pages successfully.
- API Vercel bundle, repository/GitHub Actions security, mobile secret, deterministic vector, vector/custody isolation, base V2 isolation, Slice 5F isolation, and Slice 5G isolation checks passed.
- `git diff --check` passed.

## Open boundary

Separate authority is still required to create/run physical iOS and Android probe builds. Those runs need accountable human review before production KDF parameter selection. A measured report is not a security approval, production profile, activation decision, or permission to add client transport/runtime wiring.
