# Physical iPhone Custody Probe Build Evidence

Date: 2026-08-04 (Asia/Dubai)

## Outcome

The dedicated claimant-custody probe compiled successfully as a signed internal-distribution iOS build. It is separate from the production/TestFlight Sanduqkin application and is installable only on registered Apple devices included in its ad hoc provisioning profile.

## Build Identity

- Final EAS build ID: `8b6095aa-1ec1-4550-97ae-1bf1ec66765d`.
- Status: `FINISHED`.
- Build profile: `claimant-custody-probe`.
- Distribution: `INTERNAL`.
- App version/build: `1.0.0` / `1`.
- SDK: Expo 56.
- Bundle identifier: `com.sanduqkin.mobile.claimantprobe`.
- Router root: `./probe-app`.
- EAS fingerprint: `a7fdbb52437ea6d96733174cedd4af5d1e157db5`.
- Started: `2026-08-04T15:47:31.220Z`.
- Completed: `2026-08-04T15:54:05.844Z`.
- Artifact expiry: `2026-08-18T15:47:31.275Z`.
- Build page: `https://expo.dev/accounts/shahbaz242630/projects/sanduqkin/builds/8b6095aa-1ec1-4550-97ae-1bf1ec66765d`.

## Local Host Source Fingerprint

- Probe host/config/test aggregate SHA-256: `9eabcd0a3296b44b0e562f9e81a4ca949e8f17d6467a05a0d7b795ea41826264`.
- Fingerprint algorithm: sort the six probe host/config/test paths ordinally, calculate SHA-256 over each complete file, serialize each as `<lowercase-sha256><two spaces><path>` joined by LF, then SHA-256 the UTF-8 serialization. Documentation is excluded to avoid a recursive hash.

An earlier successful build `1c6cc87c-7b63-4405-ba25-dc19d2077c02` was superseded after an Expo Doctor compatibility refactor. The refactor preserved the resolved probe configuration, and both builds share EAS fingerprint `a7fdbb52437ea6d96733174cedd4af5d1e157db5`. Use only the final build above for physical evidence.

EAS displays base Git commit `887abd0459197c5123b8972e1b8c5bed14ec5528` because the claimant work remains an unpublished local bundle. The EAS fingerprint identifies the uploaded working-tree build input; this record does not claim the base commit alone contains the probe.

## Isolation

- Dynamic Expo configuration leaves normal Sanduqkin builds on `./app`, scheme `sanduqkin`, and bundle `com.sanduqkin.mobile`.
- Only `SANDUQKIN_BUILD_TARGET=claimant_custody_probe`, supplied by the internal EAS profile, selects `./probe-app`, scheme `sanduqkin-claimant-custody-probe`, and the separate probe bundle.
- The probe app imports no Supabase, RevenueCat, vault repository, claimant API, notification, evidence, or release code.
- Its single screen calls only the four-method probe-only native module through the value-free evidence coordinator.
- Export-compliance metadata is explicit: `ITSAppUsesNonExemptEncryption=false`, consistent with the previously approved export-compliance handling for standard/exempt cryptography.
- No TestFlight submission, App Store submission, deployment, hosted Supabase change, claimant-runtime activation, DNS, or production application replacement occurred.

## Physical-iPhone Evidence

On 2026-08-04, Shahbaz Malik reported that the complete requested value-free matrix passed on the registered physical iPhone using final build `8b6095aa-1ec1-4550-97ae-1bf1ec66765d`:

- the separate internal probe app installed and opened;
- the authenticated run returned `PASS`, capability `eligible`, creation `created`, exercise `passed`, cleanup `deleted`, and key continuity `confirmed`;
- cancelling device-owner authentication returned the expected fail-closed result with exercise `authentication_failed` and cleanup `deleted`; and
- the subsequent authenticated retry returned the original complete `PASS` result.

No device identifier, biometric/passcode prompt, key/fingerprint value, proof material, claimant data, or vault data was recorded. This owner-reported evidence closes the Apple compile and physical pass/cancel/retry/cleanup gates for the disposable probe harness only. It does not approve a production claimant key alias, enrollment adapter, live possession challenge, invitation acceptance, or external claimant access.

## Local Verification

- Mobile: 420 tests passed and 3 existing tests skipped across 116 files.
- Mobile typecheck passed.
- Expo Doctor: 21/21 checks passed.
- Full repository lint, repository/GitHub Actions security, mobile secret, claim-vector reproducibility/isolation, claimant custody isolation, and `git diff --check` passed.
