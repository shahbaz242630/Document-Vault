# Native Enrollment Independent Review Manifest

Remediated: 2026-08-12 (Asia/Dubai)

## Scope And Identity

This value-free manifest binds the exact runtime-disconnected Slice 1B/1C remediation
snapshot accepted after the 2026-08-12 adversarial review.

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528` plus the authoritative local claimant bundle.
- Slice 1B fourteen-file aggregate: `c837de44f5da4f71c149d9e90b1a4a79ee39eeda72eb11985063e2838a003bd1`.
- Slice 1C seventeen-file aggregate: `7ac6028f4e0fd4475122af264e2e7754e9c88d702cc154a6a8f39627cb07b337`.
- Aggregate algorithm: sort paths ordinally; SHA-256 each complete file; serialize
  `<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization.
- The historical 2026-08-04 ZIP remains unchanged. The remediation ZIP is
  `review-packages/sanduqkin-native-enrollment-review-remediation-2026-08-12.zip`;
  its external hash is recorded in the closure document to avoid recursive hashing.

## Exact Files

| Scope | Path | SHA-256 |
| --- | --- | --- |
| 1C | `apps/mobile/src/features/claimant-custody/app-attest-contract.test.ts` | `5b6b19701eb1b82149a397cb138be1e447a93fdad15fe8639152a78a48629617` |
| 1C | `apps/mobile/src/features/claimant-custody/app-attest-contract.ts` | `747d410067984133298fbfa514ead4c9448dbd7735f84cc8af5e652b2538f746` |
| 1B/1C | `packages/shared-types/src/claim/canonical-json.test.ts` | `195637faf353da8ba708b542ec6d07bc60688569314a0fd038c2f09276245861` |
| 1B/1C | `packages/shared-types/src/claim/canonical-json.ts` | `3ed0959decbb8221aff4abe0804629e70dffdf220b0712eb83c184d6f32a66d3` |
| 1C | `packages/shared-types/src/claim/native-enrollment/app-attest-contracts.ts` | `514b1cdef45f8707d7ed71ea760b1a03b8eb62e1a5306b768791a1890cfd4d15` |
| 1C | `packages/shared-types/src/claim/native-enrollment/app-attest-fixtures.ts` | `b294fabe6eb2d6efe6fe820c4769cda5fbe72b61c952c80353d0e3f1b99c1052` |
| 1C | `packages/shared-types/src/claim/native-enrollment/app-attest-protocol.ts` | `ba76f0a59a48c3ab40418b66984f0d882ec0947fdb4a3166e83567d354e3aafe` |
| 1C | `packages/shared-types/src/claim/native-enrollment/app-attest-validation.test.ts` | `94da98a058e6af70d2528b852288a1278ac042b10e54d1b5c8948e716a24a3cb` |
| 1C | `packages/shared-types/src/claim/native-enrollment/app-attest-validation.ts` | `fb9d3d166ff8f8588b06d440adf1d4589f0358aa7a333a8ed2063f5f8f6ec2a8` |
| 1C | `packages/shared-types/src/claim/native-enrollment/app-attest-vector.test.ts` | `f422f52b390721201ec8ada3f018e60c5e9c43a16919e2b538bfaa47441260c1` |
| 1B | `packages/shared-types/src/claim/native-enrollment/contracts.ts` | `3ed810ca08ad158e2b8afeac9d0768834718f9a6d4a9c181d63ca43d2baf6162` |
| 1B | `packages/shared-types/src/claim/native-enrollment/fixtures.ts` | `41c3fcbcc3b8393d956487a21e0b860a5fba684f9535315ec2540f62a763335c` |
| 1C | `packages/shared-types/src/claim/native-enrollment/index.ts` | `aaea8cfc4e469ff3e31e093dd839c626713279d00ff2f12f71a12cfd3ff21c05` |
| 1B | `packages/shared-types/src/claim/native-enrollment/possession-proof-vector.test.ts` | `1e404a8d6b787f27e2a447e68c33f8b3eb9ea429998c1ac58c948f4b38f54eb5` |
| 1B | `packages/shared-types/src/claim/native-enrollment/protocol.ts` | `f9ec5c5779959f125c5a337b8f97322384b66ffcd3feb0794c8b78c8a3646433` |
| 1B | `packages/shared-types/src/claim/native-enrollment/validation.test.ts` | `a4686ddbfa6bf37e943dd5e792a1aca5fb7f883b2772d0418b88074ebc616e27` |
| 1B | `packages/shared-types/src/claim/native-enrollment/validation.ts` | `8e9172ef084d946174162fb1874067bdd3b53e614dd043700cf2b13a9dc2bb0b` |
| 1C | `packages/shared-types/test-vectors/claim/app-attest-binding-v1.json` | `506c7185fb494ef7bbcaaf8936ae528bfbddb8146bfb178d1c8730169d6e1a17` |
| 1B | `packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json` | `d22aa6a9633669c6afa981c104762199a0f7dbf8e69b1eb5fdb50fd4eb819b35` |
| 1C | `scripts/claim-custody-isolation-check.cjs` | `d693cb449159c4251750935702ad97469981f8588eddcd8725c8e42d98f227e5` |
| 1C | `scripts/claim-vector-generator/app-attest-binding-vector.mjs` | `d9d5375aa8d367cee5c068a3b5fbc9f31ee9aa63d5e6475e7d78c24f5da2b701` |
| 1B | `scripts/claim-vector-generator/native-enrollment-proof-vector.mjs` | `64d793e9209fc5504fca413184c4dbc462e2d7357ddd23ef762e857d831a9541` |
| 1C | `scripts/claim-vector-isolation-check.cjs` | `c4dfb9851c174bf432e2476e5479b9d171f0dbb3d4c8b3a05e291c69fdfbf247` |
| 1C | `scripts/generate-claim-test-vectors.mjs` | `55c7424ca2cbde028a0a97ca134570c95e52c92ff22493d339d1de4bd4ba7891` |
| 1C | `services/api/src/claimant/app-attest-contract.test.ts` | `bd1025178bfa131343ce61fe7f289bbd24ed4d8ddeb18fa436c8d0bb41f9493d` |
| 1B | `services/api/src/claimant/invitation-address-v1.test.ts` | `3d211cc7587a8d616fcfb7b32fc56a448bb871a3e463c1bb1f9330c107895920` |
| 1B | `services/api/src/claimant/invitation-address-v1.ts` | `318f1f619b0632616b6ce740b416dd324b97e5420f7d4a437948242768622ada` |
| 1B | `services/api/src/claimant/native-enrollment-verifier-contract.test.ts` | `b0c7b6f0c7aad74bddc68362b27e67ed280ecf5dfe305171d1d8becd290e1c24` |
| 1B | `services/api/src/claimant/native-enrollment-verifier-contract.ts` | `3926f475c02ad1b55591887246bb1a137f28ca2c993ca814c796854e4ba34487` |

The canonical serializer/test intentionally appear in both aggregates because both
transcripts depend on their server-produced bytes.

## Supporting Specifications And Evidence

- `docs/superpowers/specs/2026-08-04-claimant-slice-1b-native-bootstrap-handoff.md`
- `docs/superpowers/specs/2026-08-04-claimant-slice-1b-possession-proof-review-pack.md`
- `docs/superpowers/specs/2026-08-04-claimant-slice-1c-app-attest-contract.md`
- `docs/superpowers/specs/2026-08-04-native-enrollment-independent-review-packet.md`
- `docs/verification/2026-08-04-native-enrollment-contract.md`
- `docs/verification/2026-08-04-native-enrollment-possession-proof-review-pack.md`
- `docs/verification/2026-08-04-slice-1b-internal-adversarial-review.md`
- `docs/verification/2026-08-04-app-attest-contract.md`
- `docs/verification/2026-08-04-ios-secure-enclave-probe-harness.md`
- `docs/verification/2026-08-04-physical-iPhone-custody-probe-build.md`
- `docs/verification/2026-08-12-native-enrollment-adversarial-pre-review.md`

The owner closure is a detached companion to the ZIP so it can record the archive hash
without creating a self-referential artifact.

## Reproduction Commands

```text
npm --workspace @vault/shared-types test -- --run src/claim/native-enrollment/validation.test.ts src/claim/native-enrollment/possession-proof-vector.test.ts src/claim/native-enrollment/app-attest-validation.test.ts src/claim/native-enrollment/app-attest-vector.test.ts
npm --workspace @vault/mobile test -- --run src/features/claimant-custody/native-enrollment-contract.test.ts src/features/claimant-custody/app-attest-contract.test.ts
npm --workspace @vault/api test -- --run src/claimant/native-enrollment-contract.test.ts src/claimant/native-enrollment-verifier-contract.test.ts src/claimant/invitation-address-v1.test.ts src/claimant/app-attest-contract.test.ts
npm run check:claim-vectors
npm run check:claim-vector-isolation
npm run check:claim-custody-isolation
npm run check:security
npm run check:github-actions-security
npm run check:mobile-secrets
npm run typecheck
npm run lint
git diff --check
```

## Verification Snapshot

- Mobile: 422 passed and 3 existing skipped.
- Web: 150 passed.
- Shared types: 127 passed.
- API: 85 passed.
- Typechecks, full lint, security guards, vector reproducibility/isolation, custody
  isolation, and `git diff --check` passed.
- No claimant production flag, live route, entitlement, credential, hosted migration,
  external configuration, or real data was introduced.
