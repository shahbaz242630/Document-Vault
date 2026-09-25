# Slice 6E — offline-code emergency sheet payload and first claimant screen

Selected and owner-approved on 2026-09-25, stacked on Slice 6D (PR #93). This is the first claimant-facing slice.

## Owner decision

A real claimant holding only the printed locator and secret cannot produce an offline-code V2 proof. The proof also needs the KDF profile and the record binding: locator record, version and commitment, grant, owner, KDF profile ID, proof-key version and proof public key. By design (5C), the server will not disclose these before possession is proven. Slice 5I left the distribution of this local material undesigned.

The owner chose that **the owner's printed emergency sheet carries everything the claimant needs as a QR code**: the locator, the client secret, the KDF profile and the record binding. The locator and secret remain printed for reference. Whoever holds the sheet already holds the secret, so also carrying the owner and grant identifiers adds no meaningful exposure. The protocol, server and database are unchanged.

## Scope

1. **Sheet payload contract** (`packages/shared-types`, offline-code V2).
   - A versioned text payload, `SKQ2.` followed by the base64url of canonical JSON: `protocol`, `purpose: "emergency_sheet"`, `sheet_version: 1`, `public_locator`, `client_secret`, `kdf_profile` and `record_binding`.
   - A strict parser. It rejects:
     - any other prefix, whitespace, padding or non-canonical encoding, and oversize input;
     - unknown or missing fields;
     - a component that fails its existing validator;
     - a KDF profile that doesn't match the binding's `kdf_profile_id`.
   - The parser returns only the validated material and fails with one generic error, so no detail about the secret leaks through error messages.
   - An encoder, used by tests now and by owner-side sheet generation later.
   - Round-trip, hostile-input and fixture-vector tests.
   - The locator commitment is still verified cryptographically by the existing proof core before any proof is sent.
2. **Claim-flow controller** (mobile, `claimant-journey`).
   - A small state machine over a narrow runtime handle. Its states are: unavailable, ready, checking, claim started, sheet not recognised, and couldn't start.
   - It parses the sheet, builds a fresh synthetic attempt with new idempotency keys, activates the portal session, starts the journey, and shows only the value-free draft result.
   - The sheet text and parsed secret are never kept in state or snapshots.
   - Failures stay generic. Background, kill switch and disposal close the flow.
   - Retries are out of scope for this slice.
3. **Bootstrap handle.**
   - The 6A bootstrap gains one accessor that returns the narrow claim-flow handle, and only while it is ready.
   - The normal app mount stays inert, so the accessor returns nothing, the launch policy stays false/false/engaged, and no claimant operation becomes reachable in the real app.
4. **First screen**: `app/claim/offline-code.tsx`, reached only by direct route with no navigation entry.
   - With no handle (always, in the real app), it shows "Claiming with an emergency sheet isn't available yet."
   - With a handle (tests only), it shows a field for the scanned sheet payload, a submit action and the controller's states, with accessible labels.
   - Camera QR scanning comes in a later slice, because it adds a native camera dependency and a new build.
   - The layout provides the handle through a context module that does not import or name the bootstrap, so the existing isolation checks stay valid.

## Acceptance

- The sheet round-trips; the fixture vector parses; every hostile mutation is rejected with the same generic error.
- The controller happy path reaches "claim started" with only the value-free draft.
- Sheet-not-recognised and couldn't-start states are generic and hold no secret.
- The kill switch and backgrounding close the flow during every step.
- The normal mount yields no handle and the screen shows "unavailable".
- Focused tests; workspace tests, typechecks and lint; all claimant isolation checks, with any guard change limited to allowing the new accessor and context; security/audit; Expo Doctor; web build; CI with an exact-head watcher.

## Non-goals

Owner-side sheet generation and printing, the camera scanner, navigation entries, retry UI, other claimant screens, hosted MFA, production native custody or signing, providers, persistence, migrations, deployment, real data and activation.
