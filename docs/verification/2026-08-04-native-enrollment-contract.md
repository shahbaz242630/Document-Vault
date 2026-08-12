# Native Enrollment Contract Increment Evidence

Date: 2026-08-04 (Asia/Dubai)

## Scope

This value-free record covers the first runtime-disconnected Slice 1B increment defined in `docs/superpowers/specs/2026-08-04-claimant-slice-1b-native-bootstrap-handoff.md`.

The increment adds strict shared contracts, validation, deterministic synthetic fixtures, and mobile/web/API consumers for the iOS Secure Enclave first-key challenge request, public server challenge, and possession proof. It adds no production key alias, native key operation, database table, API route, invitation delivery, invitation acceptance, Supabase configuration, or external runtime.

## Source And Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the existing local Phase 0-2 in-progress bundle.
- Contract implementation aggregate SHA-256: `83ee18040904368bf95370425e80d3ac6cfe4b139ccbe9b0cf93408cb353da0d`.
- Fingerprint algorithm: sort the nine implementation/test paths ordinally, calculate SHA-256 over each complete file, serialize each as `<lowercase-sha256><two spaces><path>` joined by LF, then SHA-256 the UTF-8 serialization. Documentation is excluded to avoid a recursive hash.

## Enforced Boundary

- Only the current iOS `secure_enclave` / P-256 ECDH / transaction-bound user-presence capability is eligible in this increment.
- Android, software custody, missing transaction binding, and altered capability claims fail validation.
- Challenge requests cannot contain a user/actor ID, role, raw address/email, recipient-address digest, client eligibility, acceptance decision, private key, shared secret, or proof key.
- Public key, fingerprint, device binding, invitation reference, challenge, claimant key, version, expiry, origin, nonce, and proof bindings are exact and cross-validated.
- The same deterministic fixture is consumed by shared types, mobile, web, and API tests without network or persistence.
- Claimant runtime flags and `CLAIMANT_CUSTODY_PROBE_ENABLED` remain false.

## Verification

- Shared claimant types: 113 tests across 19 files passed.
- Mobile: 409 tests passed and 3 existing tests skipped across 114 files.
- Web: 149 tests across 43 files passed.
- API: 74 tests across 19 files passed.
- All workspace typechecks and full repository lint passed.
- Repository security, GitHub Actions security, mobile secret, claim vector reproducibility/isolation, claimant custody isolation, and `git diff --check` passed.

## Remaining Stop Gates

- Hosted claimant MFA remains parked on the Free plan, while existing server AAL2 enforcement remains mandatory.
- Approve server ephemeral-key custody, expiry, HKDF labels, canonical proof context, and failure handling with an independent cryptographic reviewer.
- Record an Apple native compile and value-free physical-iPhone Secure Enclave evidence for the production-shaped key APIs.
- Decide the exact opaque invitation locator/delivery and server-side verified-address normalization rules.
- Do not add a live challenge route or call invitation acceptance with an unproven key before those gates close.
