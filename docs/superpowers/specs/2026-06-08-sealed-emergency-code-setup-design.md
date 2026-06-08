# Sealed Emergency Code Setup Design

## Status

Approved direction for the next small emergency-access slice. This design covers user-side sealed emergency code setup, status display, revoke, and regenerate behavior only.

## Goal

Let an unlocked user create a sealed emergency access code package that can later support emergency key release without giving Sanduqkin, Supabase, support staff, or email systems access to vault plaintext, raw emergency codes, recovery phrases, plaintext MEKs, or generated PDFs.

## Scope

This slice turns the existing disabled `Sealed Emergency Code` option into a working setup path. It does not build kin request intake, manual review, release approval, post-release decrypt, pre-authorized kin account exchange, server-side activation workflows, or PDF export.

## Security Rules

- The raw emergency code is generated on device, shown to the user once, and never sent to Supabase.
- The app uses the raw emergency code locally to derive a wrapping key and wrap the current vault MEK.
- Supabase stores only grant metadata, wrapped MEK ciphertext, nonce, KDF salt, KDF params, wrapping algorithm, status, and timestamps.
- Audit metadata must not include raw emergency code, plaintext MEK, decrypted vault fields, asset titles, notes, or generated documents.
- A revoked grant remains non-usable and should be treated as unavailable by future release flows.
- Regeneration revokes the previous active sealed-code grant before creating a replacement.
- If the vault is locked, setup, revoke, and regenerate actions are refused until the user unlocks locally.
- This slice must not email, upload, print, or display decrypted vault contents.

## User Experience

The `Emergency access` settings screen continues to show `Pre-Authorized Kin` first with the `Highly recommended` badge. That option remains disabled with copy explaining it is planned for a later verified-kin setup.

The `Sealed Emergency Code` card becomes actionable:

1. Initial state shows `Create emergency code`.
2. Tapping opens an acknowledgement panel or confirmation step with these required points:
   - Sanduqkin cannot recover the code if lost.
   - Someone with the code may be able to access the vault after emergency approval.
   - The user should give it to next of kin or keep it with important papers.
   - The user should not send it by email or chat.
3. After acknowledgement, the app generates the code and stores the sealed wrapped-MEK grant.
4. The app shows the code in a protected one-time confirmation state with clear copy: `Write this code down now. Sanduqkin cannot show it again after you confirm.`
5. The one-time code state remains available until the user explicitly confirms they have written and checked the code, or until the app process is closed and volatile memory is lost.
6. If the user navigates back from the one-time code state without confirming, the app returns to the active setup flow and can show the code again from volatile in-memory state. It must not fetch the raw code from Supabase because Supabase never receives it.
7. If the app backgrounds, locks, reloads, crashes, or times out while the one-time code state is unconfirmed, the app must treat the raw code as lost. The persisted grant may already exist, so the next settings visit should show an interrupted setup state with actions to revoke the unusable grant or regenerate a new code.
8. The confirmation UI requires the user to attest that they wrote the code down and checked it. The confirm action should be disabled until the acknowledgement checkbox is selected.
9. After confirmation, the settings screen shows an active sealed-code configuration without the raw code.
10. Active state offers `Regenerate code` and `Revoke code`.
11. Regenerate repeats the acknowledgement and one-time display flow, after revoking any existing active sealed-code grant.
12. Revoke requires confirmation and then marks the active sealed-code grant revoked.

The screen should avoid feature-explanation walls. Copy should be direct, security-critical, and tied to the immediate action.

## One-Time Code Protection

Use `expo-screen-capture` on the one-time code screen:

- install `expo-screen-capture` through the Expo-supported install path for SDK 54 if it is not already present;
- call `usePreventScreenCapture()` while the one-time code component is mounted;
- allow screen capture again automatically when the component unmounts;
- keep the code out of route params, persistent storage, audit metadata, crash metadata, and remote logs;
- clear the volatile code from React state after the user confirms, regenerates, revokes, signs out, locks the vault, or leaves the setup flow in a way that cannot preserve the active component state.

This prevents normal OS-level screenshots and screen recordings for the protected view. It cannot stop someone from photographing the device with another camera, so the copy should still tell the user to store the written code safely.

## Data Model

Use the existing `emergency_key_grants` table from migration `20260603210500_emergency_access_foundation.sql`.

For `sealed_emergency_code` rows:

- `grant_type`: `sealed_emergency_code`
- `status`: `active` or `revoked`
- `wrapped_mek_ciphertext`: base64 encoded wrapped MEK ciphertext
- `wrapped_mek_nonce`: base64 encoded nonce
- `wrapping_algorithm`: `xchacha20poly1305_ietf`
- `kdf_algorithm`: `argon2id`
- `kdf_salt`: base64 encoded salt
- `kdf_params`: existing Argon2id metadata
- `revoked_at`: set when revoked

Do not add plaintext columns, code hashes, user-readable backup labels containing secrets, PDF paths, vault field columns, or release-state shortcuts in this slice.

## Client Architecture

Add a focused mobile repository for emergency grants:

- serialize and deserialize `EmergencyWrappedMEKPackage` to the Supabase row shape,
- load the current active sealed-code grant for the signed-in user,
- insert a new sealed-code grant,
- revoke active sealed-code grants.

Add a setup service that composes:

- `generateEmergencyAccessCode`,
- `wrapMEKWithEmergencyCode`,
- the active in-memory vault MEK from the vault session,
- the emergency grant repository,
- safe audit events.

The vault session context needs a narrow way to access the active MEK for key-wrapping operations without exposing it to route params, logs, or persistent state. The public surface should be an operation such as `createSealedEmergencyCodeGrant(repository)` rather than a generic `getMek()` export.

## Audit Events

Add safe audit event types:

- `sealed_emergency_code_created`
- `sealed_emergency_code_revoked`
- `sealed_emergency_code_regenerated`

Allowed metadata:

- `grantType: "sealed_emergency_code"`
- `previousGrantRevoked: "true"` for regeneration if useful

Forbidden metadata:

- raw emergency code,
- wrapped ciphertext or nonce,
- KDF salt,
- plaintext MEK,
- vault asset ids, titles, notes, or fields,
- file paths or generated document references.

## Failure Handling

- If no vault session is available, show an unlock-required message and do not generate a code.
- If the one-time code state is interrupted before confirmation, do not claim setup is complete. Show an interrupted setup state with `Regenerate code` as the primary action and `Revoke unusable code` as the secondary action.
- If Supabase insert fails after local code generation, do not show the code as active; show a generic save failure.
- If wrapping fails, show a generic setup failure and do not write a row.
- If revoke fails, keep the active status visible and show a generic failure.
- If regenerate fails after revoking the previous grant, show that no active sealed-code grant is configured and prompt the user to create a new one.
- All errors must be logged locally only with safe event names or generic failure context.

## Tests

Add focused tests proving:

- repository serialization stores base64 ciphertext, nonce, salt, KDF params, grant type, status, and no raw code;
- setup creates a sealed-code grant from an unlocked session and returns the raw code only to the caller for one-time display;
- locked-session setup is refused before code generation;
- unconfirmed one-time display can be revisited only while volatile in-memory code state still exists;
- interrupted setup without volatile code is shown as unusable until revoked or regenerated;
- confirming setup clears the raw code from component/service state and leaves only active non-secret status;
- the one-time code component enables screen-capture prevention while mounted;
- regenerate revokes the prior active sealed-code grant before inserting a replacement;
- revoke marks the active sealed-code grant revoked;
- audit metadata excludes raw code, ciphertext, salt, MEK, and vault plaintext;
- the settings screen no longer asserts sealed-code actions are disabled and instead covers initial, active, one-time-display, revoke, and regenerate copy states.

## Out Of Scope

- Pre-authorized kin account setup.
- Kin public/private key exchange.
- Emergency request intake.
- Manual review tooling.
- Releasing wrapped key material to kin.
- Kin-side local decrypt.
- Password-protected PDFs.
- Server-generated PDFs.
- Emailing vault contents or emergency codes.
- Remote migration deployment.

## Open Product Constraint

Real release cannot ship from this slice alone. A sealed emergency code only becomes useful after a later verified emergency-release flow exists. Until then, the UI should label it as setup for future emergency access, not as currently sufficient for kin to access the vault.
