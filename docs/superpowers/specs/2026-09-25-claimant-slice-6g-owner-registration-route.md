# Slice 6G — owner emergency-sheet registration route

Proposed on 2026-09-25 after Slice 6F merged through PR #95 at `a6e15b5`. Awaiting owner approval before coding. It is the next step named in the 6F spec. The reviewer decision stays open and is taken before go-live, not in this slice.

## Gap

Slice 6F lets the owner's device generate an emergency sheet and the registration inputs for it. Nothing can yet send those inputs to the server. The database functions (`claimant_register_offline_code_v2_locator` and `claimant_revoke_offline_code_v2_locator`, Slice 5B) and their typed server client exist. However, they are granted to `service_role` only and have no owner-facing route. The server-keyed locator index has also never been computed for a registration. Until it is, a claimant scanning a sheet cannot find the record.

## Scope

1. **Owner registration route**: `POST /owner/offline-code/v2/locators`.
   - **Gates, checked in order:**
     - a new literal-false approval constant;
     - the existing `offlineCodeV2` runtime capability, which is off everywhere;
     - an exact owner origin, from a new `OFFLINE_CODE_V2_OWNER_ORIGIN` that must differ from the claimant origin;
     - JSON content type and a 16 KiB body limit;
     - a UUIDv4 `Idempotency-Key`;
     - a bearer token. The route requires a fresh AAL2 owner session, checked with the same `authenticateActiveSession` helper the registered-recipient routes use, and asserts that the session is still active.
   - **Body.** A strict object with exactly the 6F registration fields except `ownerUserId`: `locatorRecordId`, `grantId`, `publicLocator`, `locatorCommitment`, `proofPublicKey`, `recordBindingDigest`, `kdfSalt`, `wrapNonce`, `wrapCiphertext`, `wrapAssociatedDataDigest`, `issuedAt` and `expiresAt`. Any extra field is rejected, including the printed secret, the sheet payload and any key material.
   - **The owner comes from the session only.** The owner ID is never read from the body.
   - **Server-side checks before any database call:**
     - it normalises `publicLocator` with the existing shared-types normaliser;
     - it recomputes the locator commitment from the record ID and the normalised locator;
     - it rebuilds the record binding with the session's user ID as `owner_id`, the synthetic KDF profile ID and proof-key version 1, then recomputes its digest.

     A mismatch in either rejects the request. A sheet built for another owner therefore cannot be registered under this session.
   - **Locator index.** The server computes it with exactly the same keyed digest (`OFFLINE_CODE_V2_LOCATOR_INDEX_KEY`, scope `locator`) that the challenge route uses to look records up. The shared function moves into one small module that both routes import, so the two cannot drift apart.
   - **Database call.** The route calls the existing persistence client's `register`, with the idempotency key.
   - **Response.** The route returns only `{ locator_record_id, status, replayed }`. Every failure returns a generic, value-free error: 400 invalid, 401 unauthorised, 403 fresh MFA required, 409 idempotency conflict, 404 disabled or wrong origin, 503 unavailable.

2. **Owner revocation route**: `POST /owner/offline-code/v2/locators/:locatorRecordId/revoke`.
   - It has the same gates and the same fresh-AAL2 owner session.
   - Its body is empty, and it takes no reason from the client: the reason is always `owner_revoked`.
   - It calls the existing `revoke` function, which already refuses a record the caller does not own. This lets an owner cancel a lost or exposed sheet at once, and any issued challenges are revoked with it.

3. **Preflight.** Both paths get an `OPTIONS` handler, allowed only for the owner origin.

4. **Wiring.** Both routes are mounted in `services/api/src/index.ts` behind the capability gate. With the default configuration they return 404, as the other claimant routes do.

5. **Static isolation.** A dedicated check, wired into security CI, requires:
   - the literal-false constant and the capability gate;
   - the session, not the body, as the source of the owner ID;
   - no logging of the request body;
   - no import of mobile code;
   - no second copy of the locator-index digest.

## Acceptance

- **Register, then look up.** A sheet produced by the 6F generator with the synthetic vector registers through the route. The challenge route, called with the same printed locator, then derives the same locator index and finds the record. This is an owner-to-claimant round trip against a store modelled on the 5B SQL, as in 6D.
- **Session and origin.** A missing or expired token, an AAL1 session, a stale MFA or a revoked session is rejected. So is a wrong or claimant origin.
- **Binding checks.** Registration is rejected if:
  - the sheet was built for another owner ID;
  - the commitment or record-binding digest has been tampered with;
  - the locator is malformed;
  - there is an extra body field, such as the secret;
  - there is a bad expiry or timestamp.
- **Idempotency.** Replaying with the same key and body returns `replayed: true`; the same key with a changed body returns 409.
- **Revocation.** The owner can revoke their own sheet. Revoking someone else's sheet, or one already revoked, fails generically. After revocation, the challenge route no longer issues challenges for it.
- **Disabled by default.** With default configuration, both routes return 404 before reading the body.
- **Checks.** Workspace tests, typechecks, lint, security, all isolation checks and the web build pass, and CI is green.

## Known limitations, recorded and not solved here

- **Grant IDs.** The `grant_id` is an opaque, unique ID that the owner's device creates. Nothing yet ties it to a real release grant or to a vault, and the database has no foreign key for it. Linking the sheet to the release pipeline is a later slice.
- **The wrap cannot be checked.** The server cannot confirm that the wrap really contains the owner's vault key, because it never sees the key. A bad wrap only harms the owner's own recovery. The 6H screen will re-open the wrap on the device before printing.
- **Real-PostgreSQL acceptance** needs Docker. It stays on the pre-launch list with the other database acceptance work.
- **The synthetic KDF profile only.** A production Argon2id profile is still unapproved.

## Later slices

- **6H:** an owner screen that generates, registers through this route, and prints the sheet (QR rendering).
- **6I:** the claimant camera QR scanner (a native dependency and a new build).

## Non-goals

Migrations, mobile UI or a mobile client, printing, the camera, a production KDF profile, hosted MFA, deployment, real data and activation.
