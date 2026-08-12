# Claimant Slice 1D Native App Attest Adapter

Date: 2026-08-12 (Asia/Dubai)

## Result

The bounded, runtime-disconnected Slice 1D code is complete locally. It adds an
isolated iOS App Attest adapter and value-free physical-evidence host while keeping the
ordinary application, earlier custody probe, claimant APIs, and every production
capability disabled.

Slice status is `CODE COMPLETE / NATIVE COMPILE AND PHYSICAL EVIDENCE PENDING`.
Creating Apple credentials, changing App IDs/capabilities, dispatching an EAS build, or
running a physical device was not authorized by this local slice and was not performed.

## Implemented Boundary

- Dedicated Expo native module using `DCAppAttestService` for capability inspection,
  one probe-only key identifier, attestation, assertion, and local-reference cleanup.
- Exact native bundle-ID guard on every exposed operation. Autolinking the module into
  another binary leaves it inert with `probe_build_required`.
- Dedicated `claimant_app_attest_probe` EAS profile, router root, scheme, and bundle ID.
- Development App Attest entitlement and iOS 27 deployment target exist only for that
  isolated profile. Normal and custody-probe configurations contain no entitlement.
- App Attest key ID is stored with
  `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`; no private key is exported or
  handled by application code.
- Registration and assertion hash the exact decoded opaque Base64URL challenge bytes.
  The native client does not parse or reserialize the signed transcript.
- Native output is limited to generic result metadata, the canonical Apple key ID, and
  the one required opaque attestation or assertion object. TypeScript applies an exact
  field allowlist and canonical encoding/size checks.
- Apple/native errors are collapsed to safe result classes. Receipt, counter,
  certificates, client-data hash, challenge bytes, and native error detail are excluded.
- A hard-disabled value-free evidence coordinator requires the exact non-production,
  physical-iOS, iOS-27+, operator-confirmed profile and clears the local key reference
  on every exit path.
- The evidence UI displays only run ID, generic result classes, and pass/fail. Apple
  provides no API to delete the underlying App Attest key; clearing the identifier is
  described truthfully and repeated probe runs must be controlled to avoid artificial
  fraud-metric inflation.

## Non-Goals

- No Apple CBOR, certificate-chain, nonce, RP ID, AAGUID, extension, receipt, signature,
  or assertion-counter verification.
- No server verifier, persistence, database migration, challenge route, invitation
  acceptance, claimant session, notification, or live transaction.
- No production entitlement, DeviceCheck credential, App ID/provider change, EAS build,
  deployment, external access, real claimant identity, or real data.
- No statement that local unit/static checks are Apple compile or physical-device proof.

## Verification

- Focused Slice 1D mobile tests: 13 passed.
- Complete mobile suite: 430 passed and 3 existing skipped across 119 files.
- All workspace typechecks passed.
- Full repository lint passed.
- Claimant custody isolation, claimant vector isolation, repository security guard, and
  mobile secret scan passed.
- Expo resolved the isolated profile to iOS 27, the dedicated bundle ID/router/scheme,
  and development entitlement. Normal and prior custody-probe configs were separately
  checked and contain no App Attest entitlement.
- `git diff --check` is required again at final bundle handoff.

## Exact Code Snapshot

Aggregate SHA-256: `472cfd9b59f2cfafd8d3cf1d1d12cf71b2c6c80a954f2763328551134d9bbfcf`

Aggregate algorithm: ordinal path sort; SHA-256 each complete file; serialize
`<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization.

| Path | SHA-256 |
| --- | --- |
| `apps/mobile/app-attest-probe-app/index.tsx` | `a45668ede5190e9d955344a95e189f30ff98857c06abb071830b76ace23613e2` |
| `apps/mobile/app.config.js` | `df6467875043ef93c8e137d7e6607671deaed689e368525a959996a2c810f412` |
| `apps/mobile/eas.json` | `a48718fc542a83d760b3d98441bfafdef718c22e8774de58464316c01a9cfc3a` |
| `apps/mobile/modules/claimant-key-custody/expo-module.config.json` | `3b13d16c3984f6c386dcf06e8af367b3026aa6b819bbf2fd23d4e3437553d525` |
| `apps/mobile/modules/claimant-key-custody/ios/ClaimantAppAttestModule.swift` | `664e31642b9e23c1822eeae7074295bf9cf741dde64ae46ee886c3aadbde4893` |
| `apps/mobile/modules/claimant-key-custody/src/index.ts` | `3a873d514da574be4a0c8a338573325880626099b74b4a85f29d142bad704a89` |
| `apps/mobile/src/features/claimant-custody/app-attest-adapter.test.ts` | `79a2367b97e4695798707d5bfcdee0bdf66e45c105f4bb43db352c84b711f5d4` |
| `apps/mobile/src/features/claimant-custody/app-attest-adapter.ts` | `719bf84d1a25e2b2fe52916ce33f41159486797c9342a12e1f1476a0135cf74a` |
| `apps/mobile/src/features/claimant-custody/app-attest-evidence-runner.test.ts` | `e7e7cf0ab091f850227f1ef8047dc294bc59bf891f56966f4dcfc892bcbfa279` |
| `apps/mobile/src/features/claimant-custody/app-attest-evidence-runner.ts` | `e9f42ed8c7baa38af7bb7dfe47efc4d88a0f31a240024d340680d2fa68caaaec` |
| `apps/mobile/src/shared/config/claimant-custody-probe-build-config.test.ts` | `cb493771239d1702aa4a45445a61e5423e66e378a5acef7d1578ddbcc866c262` |
| `scripts/claim-custody-isolation-check.cjs` | `84ca026f1e5072e8a07fb306c056633fd7db0d7e003cd1dd719c67c821075ac8` |

## Exit Work

With exact owner authorization for external Apple/EAS actions:

1. Confirm the dedicated App ID and development App Attest capability without changing
   the production Sanduqkin App ID.
2. Compile the exact aggregate through the protected isolated EAS profile.
3. Run the value-free physical iPhone matrix on iOS 27+: first registration/assertion,
   unsupported/pre-iOS-27 fail-closed behavior, Apple-unavailable retry, missing local
   reference, cancellation/failure, reinstall/key replacement, and cleanup semantics.
4. Record build identity and generic pass/fail evidence only. Any source change requires
   new hashes and a repeat compile/device run.

Only after those items pass may Slice 1D be marked complete. Slice 1E server verification
and persistence remains a separate disabled implementation slice.
