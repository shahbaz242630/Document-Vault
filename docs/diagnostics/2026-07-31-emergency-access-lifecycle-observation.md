# Emergency Access Lifecycle Observation

Date: 2026-07-31 (Asia/Dubai)

Status: observation and controlled test-account lifecycle exercise only; no application, database schema, RLS, or claimant-runtime change was made.

## Scope

1. Observe the inert `Set up trusted person` control.
2. Revoke the existing sealed emergency-code grant and verify the owner UI and Supabase state.
3. Create and confirm a replacement without retaining or exposing the one-time code.
4. Exercise the dedicated `Regenerate code` action and verify replacement/revocation semantics.
5. Establish what this owner-side evidence does and does not prove about a future claimant release.

## Environment

- AVD: `Pixel_7`
- Android API: 36
- Package: `com.sanduqkin.mobile`
- Client: debug development client from current `main`
- Account: disposable authenticated test account; credentials and user identifiers are not retained in this record
- Database checks: authenticated through the public mobile Supabase client and restricted by the account's existing RLS policies

## Trusted-Person Control

The Android accessibility tree reports:

- label: `Set up trusted person`
- role: button
- clickable: true
- enabled: false

The component passes the `disabled` prop unconditionally to the `Pre-Authorized Kin` card. This is therefore a current owner-UI implementation state, not an Android missed-tap or overlay problem. No fix was made.

## Sealed-Code Baseline

Before the exercise, Supabase contained 52 sealed-code grant rows for the test owner:

- active: 1
- revoked: 51
- released: 0

The active row used:

- wrapping algorithm: `xchacha20poly1305_ietf`
- KDF: `argon2id`
- non-empty KDF salt
- non-empty wrapped-MEK ciphertext and nonce

No ciphertext, nonce, salt, raw emergency code, owner UUID, session token, or credential was retained.

## Controlled Lifecycle

### Direct revoke

Pressed `Revoke code` on the active owner screen.

Observed:

- The UI returned to `Before creating a code`.
- Supabase active count became zero.
- The former active row changed to `revoked`.
- Its `updated_at` and `revoked_at` were both set to `2026-07-31T07:55:24.711Z`.

### Replacement creation and confirmation

Acknowledged the warning, created a replacement, and confirmed the one-time-code screen through the controls without reading, copying, dumping, logging, or storing the code.

Observed:

- Supabase inserted one new active sealed-code grant.
- Exactly one active grant existed.
- The replacement contained the expected XChaCha20-Poly1305/Argon2 envelope fields.
- After leaving and reopening the Emergency Access route, the UI reported `Emergency code active`.

### Dedicated regeneration

Pressed the active screen's `Regenerate code` control, then confirmed the new one-time-code screen without retaining the code.

Observed:

- The preceding replacement changed from `active` to `revoked` at `2026-07-31T07:58:56.811Z`.
- A fresh grant was inserted at `2026-07-31T07:59:00.185038Z`.
- The final Supabase state was:
  - total sealed-code grants: 54
  - active: 1
  - revoked: 53
  - released: 0
- The newest row is active, not revoked or released.
- It has `xchacha20poly1305_ietf`, `argon2id`, a non-empty KDF salt, a non-empty ciphertext, and a non-empty nonce.
- After another route remount, the owner UI still reported `Emergency code active`.

## Verification

Focused mobile tests passed:

- test files: 4 passed
- tests: 15 passed
- coverage exercised the sealed-code service, Supabase grant repository, emergency key wrapping, Emergency Access component, and the supplied Emergency Access route test selection

The live exercise additionally verified the real authenticated UI-to-Supabase revoke, create, confirm, and regenerate paths.

## User Handoff State

After completing the persisted lifecycle checks above, regeneration was invoked once more so the test owner—not the diagnostic process—can retain the current one-time code.

- The emulator is intentionally left on the one-time-code confirmation screen.
- The code was not read, copied, dumped, logged, or stored by the diagnostic process.
- Supabase now contains 55 sealed-code grant rows:
  - active: 1
  - revoked: 54
  - released: 0
- The final active row was created at `2026-07-31T08:02:16.361326Z` and contains a complete XChaCha20-Poly1305/Argon2 envelope.
- The preceding active grant was revoked by this final regeneration.

The owner must write down and check the code currently visible in the emulator, then select `I wrote down and checked this code.` and press `Confirm code is saved`. Navigating away first will deliberately produce the interrupted-setup state.

### Final owner confirmation

After the development reload correctly converted the earlier unconfirmed grant to an interrupted setup, the owner regenerated the code, retained it outside the diagnostic process, and confirmed it in the app.

Final verification:

- The protected one-time-code state cleared.
- Reopening Emergency Access reports `Emergency code active`.
- Supabase contains 56 sealed-code grants: 1 active, 55 revoked, and 0 released.
- The newest row was created at `2026-07-31T14:56:25.483258Z`.
- The newest row has a complete XChaCha20-Poly1305/Argon2 envelope.
- No raw code or encrypted grant material was read or retained by the diagnostic process.

## Same-Profile Binding

The owner-side implementation wraps the MEK from the current authenticated vault session and inserts the grant with `user_id` defaulting to `auth.uid()`. Owner reads and updates are restricted to that same `user_id` by RLS. This establishes that the stored sealed package is attached to the test owner's profile and was produced from that profile's in-memory vault key.

It does **not** establish an end-to-end claimant unlock. The current V1 sealed code has no safe public locator, and the claimant authentication, lookup, evidence, review, approval, release-package, retrieval, and local-decryption runtime remains hard-disabled. A claimant cannot safely locate this row by presenting the V1 code, and possession of a code must never itself authorize release.

The desired future result—an approved claimant receiving ciphertext plus the correct claimant-addressed release material for this owner—requires the reviewed V2 split locator/secret protocol and the full approval/release cycle described in `CLAIM_HANDOFF.md` and `SECURITY_HANDOFF.md`.

## Stop Point

The owner-side sealed-code lifecycle is wired and persisted for this test account. Final local confirmation is deliberately left to the owner so the only usable copy of the current code remains under owner control. The trusted-person entry remains intentionally disabled in the component. No claimant runtime was enabled and no application fix was made.
