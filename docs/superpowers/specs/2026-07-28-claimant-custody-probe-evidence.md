# Claimant Custody Probe Evidence

Last updated: 2026-07-28 (Asia/Dubai)

## Scope

Value-free evidence for the owner-approved, runtime-disconnected claimant custody feasibility slice. No claimant account, production key alias, public-key upload, API, database, invitation, evidence, notification, release, or decryption path was used.

## Implemented

- A local Expo module auto-linked from `apps/mobile/modules/claimant-key-custody`.
- An iOS Secure Enclave P-256 key-agreement probe using a passcode-required, device-only Keychain item and user-presence access control.
- An Android Keystore P-256 key-agreement probe restricted to API 31+, an accepted TEE or StrongBox security level, an unexportable private key, and a probe-only alias.
- A TypeScript probe contract with fail-closed result classes, unconditional test-alias cleanup, and an application-runtime flag fixed to `false`.
- A deterministic `registered_recipient_v2` reference vector covering canonical P-256 public keys, ECDH, HKDF-SHA-256, possession MAC, XChaCha20-Poly1305 wrapping, and binding failures.
- Offline vector consumers in shared types, mobile, web, and API tests.
- Isolation guards proving there is no claimant runtime, network, Supabase, browser persistence, notification, evidence, or release integration.

## Verification

| Check | Result |
| --- | --- |
| Expo Android autolinking | Pass; `@sanduqkin/claimant-key-custody` discovered |
| Android module Kotlin compile | Pass; `:sanduqkin-claimant-key-custody:compileDebugKotlin` |
| Integrated Android app Kotlin compile | Pass; `:app:compileDebugKotlin`, app minimum SDK remains 24 |
| Android debug APK rebuild | Pass; `:app:assembleDebug`, package `com.sanduqkin.mobile`, SHA-256 `602583AC023A4A4C661A0226116100DC42A737CD81E21CE3CF1047CD89A05CB8` |
| Shared V2 vector verification | Pass |
| Mobile custody and vector tests | Pass |
| Web/API V2 consumer tests | Pass |
| Vector reproducibility and isolation | Pass |
| Custody runtime-isolation guard | Pass |
| Repository typecheck and lint | Pass |
| Web production build and mobile coverage | Pass |
| Expo Doctor | Pass; 21/21 |
| Database catalog and hostile RLS checks | Pass |
| Production dependency audit | Pass; zero vulnerabilities |
| Physical Android device | Not run; `adb devices -l` reported no device |
| iOS native compile | Not run; current environment is Windows |
| Physical iOS Secure Enclave | Not run; Apple build environment and device required |

## Material Finding

The Android 36 toolchain can generate and use hardware-backed P-256 ECDH keys, but it cannot bind `KeyAgreement` to `BiometricPrompt.CryptoObject`. Android documents that constructor as added in platform version 36.1. A separate prompt or positive authentication timeout would weaken the approved transaction-bound requirement.

The Android capability result is therefore `transaction_bound_auth_unavailable` and `eligible: false`. The code does not silently downgrade to a timed authentication window or software key.

## Cleanup And Runtime State

- Native aliases contain `probe-only`; no production alias exists.
- The TypeScript capability remains hard-disabled with no environment override.
- No physical probe ran, so no hardware alias was created in this session.
- No production or personal data appears in fixtures or evidence.
- Claimant authentication, persistence, API, invitation, evidence, notification, processor, release, and decryption capabilities remain disabled.

## Stop Gate

Stop before registered-recipient runtime preparation. Required next decisions are:

1. the acceptable Android transaction-binding design and minimum platform baseline;
2. physical iOS and representative Android device testing;
3. independent cryptographic and native-platform review; and
4. confirmation that the non-recoverable single-device claimant model remains acceptable.
