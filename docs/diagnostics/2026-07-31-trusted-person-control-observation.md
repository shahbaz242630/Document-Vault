# Trusted-Person Control Observation

Date: 2026-07-31 (Asia/Dubai)

Status: diagnosis only; no application, route, invitation, schema, RLS, claimant-runtime, or release change was made.

## Scope

Trace the owner-side `Set up trusted person` control from the Android UI through its component, route, available mobile screens, data access, tests, history, and current claimant/security authorization boundary.

## Live Observation

Before the final sealed-code regeneration, the Android accessibility tree reported:

- label: `Set up trusted person`
- role: button
- clickable: true
- enabled: false

The user's tap produced no navigation or visible action. This matches the rendered disabled state.

A second live tap was not attempted after the final regeneration because the emulator remains on the protected one-time-code screen. Android reports the Sanduqkin window has `FLAG_SECURE`; navigating away before the owner confirms the code would deliberately turn that grant into an interrupted setup.

## Direct Cause

`apps/mobile/src/features/settings/components/emergency-access-screen.tsx` renders the `Pre-Authorized Kin` option with:

- `disabled` hard-coded;
- no trusted-person `onPress` prop;
- no route or handler supplied for this option.

`apps/mobile/app/settings/emergency-access.tsx` wires only sealed-code create, confirm, regenerate, and revoke operations. It contains no trusted-person handler or router destination.

The mobile route tree contains no trusted-person setup, recipient invitation, recipient status, recipient replacement, or recipient revocation screen.

## Missing Runtime Layers

The repository contains:

- a legacy owner-only `emergency_contacts` table;
- a `pre_authorized_kin` grant discriminator;
- pure MEK wrap/unwrap helpers that accept a supplied 32-byte kin wrapping key.

It does not contain a production owner-side trusted-person repository/service or runtime for:

- value-free invitation creation;
- recipient account/address binding;
- fresh `aal2`;
- claimant hardware-key enrollment and public-key registration;
- owner validation of the recipient key and fingerprint;
- owner-local recipient-addressed MEK grant finalization;
- replacement or revocation coordination.

The existing `emergency_contacts`, `emergency_key_grants`, and `emergency_release_requests` foundation is explicitly not an approved claimant workflow schema.

## History

- The card label entered the repository in the initial Emergency Access shell.
- The explicit `disabled` prop was added with the sealed emergency-code setup work.
- It has remained disabled since that approved slice.
- The approved sealed-code design states that `Pre-Authorized Kin` remains disabled and that pre-authorized account setup/key exchange is out of scope.

This is not a newly broken press handler. The current Build-5 behavior is the continuation of an intentionally disabled earlier design.

## Test Gap

The current Emergency Access component test checks that the trusted-person label and explanatory copy exist. It does not require:

- the control to be enabled;
- an `onPress` handler;
- navigation to an owner-side destination;
- a safe informational unavailable-state response.

The route test checks only the Emergency Access shell and sealed-code interruption handling. It contains no trusted-person action assertion.

Consequently, the existing tests pass while the control remains inert.

## Handoff And Authorization Conflict

The current handoffs describe the inert card as an owner-UI routing/action regression and instruct the next worker to confirm the approved owner-side destination. The repository and approved designs do not currently contain such a destination.

The future functional destination is described only at the Stage 2 product level:

1. value-free single-use invitation;
2. verified recipient account and fresh `aal2`;
3. approved native hardware-backed claimant key custody;
4. public-key registration;
5. unlocked owner validation and recipient-addressed grant finalization;
6. replacement and revocation.

Stage 2 remains blocked by the Android transaction-binding/platform decision, physical iOS/Android custody evidence, independent security review, and the claimant key recovery/multi-device decision. Current instructions explicitly prohibit invitations, claimant authentication, persistence, migrations, APIs, notifications, claim submission, review, release, and decryption runtime.

## Diagnosis

There is no hidden Android error, swallowed navigation event, or isolated missing route name to repair. The control is inert because all three immediate wiring elements are absent by design:

1. it is explicitly disabled;
2. it has no press handler;
3. it has no implemented or currently authorized functional destination.

Enabling the button and inventing a setup route would cross the current claimant-runtime stop gate. A safe non-runtime informational destination could be designed, but it is not presently specified or approved and would not constitute trusted-person setup.

## Required Decision Before A Fix

Choose and approve one of these scopes:

1. Keep the card disabled and make its unavailable status explicit instead of presenting it as an actionable setup control.
2. Add a bounded informational owner-side screen explaining that verified-recipient setup is not yet available, with no form, identifier collection, invitation, persistence, or network action.
3. Defer an actual setup flow until the Stage 2 security gates are satisfied and the registered-recipient preparation slice is separately authorized.

The current security documents support options 1 or 2 now. They do not authorize option 3.

## Stop Point

The root cause and missing layers are identified. No fix was attempted. The emulator remains on the protected final emergency-code confirmation screen so the owner can retain and confirm the fresh code safely.

## Approved Follow-Up Implemented

Later on 2026-07-31, the owner requested implementation together with marriage/death certificate support. The implemented trusted-person scope follows option 2 above:

- The Emergency Access card now exposes an enabled `View setup requirements` action.
- The action navigates to `/settings/trusted-person`.
- The destination is information-only and clearly states that setup is not available yet.
- It creates no invitation, collects no recipient identifier or personal details, performs no network/database action, and enables no claimant or release capability.
- The screen explains the future value-free invitation, eligible-device protected key, owner-local encrypted grant, and separate identity/evidence/review/approval requirements.

Live Android verification confirmed the control is enabled and clickable, navigation succeeds, the gated copy renders, and Logcat contains no React Native or fatal navigation error.

Adding the route triggered an Expo Router development reload. Because the final sealed emergency code had not been locally confirmed, its volatile raw code was correctly discarded and the persisted grant now appears as `setup interrupted`. It must be regenerated again when the owner is ready to retain and confirm the replacement.
