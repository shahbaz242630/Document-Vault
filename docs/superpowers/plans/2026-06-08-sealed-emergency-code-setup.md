# Sealed Emergency Code Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the sealed emergency code setup path so an unlocked user can create, confirm, revoke, and regenerate an emergency-code-wrapped MEK grant without exposing raw codes or vault plaintext to Sanduqkin/Supabase.

**Architecture:** Keep the work inside the mobile vault/settings features. Pure vault modules serialize emergency grant rows and coordinate setup/revoke/regenerate operations; the settings screen owns the acknowledgement, one-time code display, interruption state, and screen-capture prevention. Every slice ends with focused tests and a `HANDOFF.md` update.

**Tech Stack:** Expo SDK 54, React Native, Expo Router, TypeScript, Vitest, Supabase client shape, `expo-screen-capture`.

---

## Slice 1: Screen Capture Dependency And Safe Audit Events

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `package-lock.json`
- Modify: `apps/mobile/src/features/auth/audit-log.ts`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Install `expo-screen-capture`**

Run from `apps/mobile`:

```powershell
npx expo install expo-screen-capture
```

Expected: `apps/mobile/package.json` and root `package-lock.json` include an Expo SDK 54-compatible `expo-screen-capture` dependency.

- [ ] **Step 2: Add failing audit type coverage**

Add a focused assertion to `apps/mobile/src/features/auth/audit-log.test.ts`:

```ts
it("accepts sealed emergency code event types without secret metadata", () => {
  const auditLog = createAuditLog();

  auditLog.log({
    deviceInfo: "React Native",
    eventType: "sealed_emergency_code_created",
    metadata: { grantType: "sealed_emergency_code" },
  });

  expect(auditLog.events[0]?.eventType).toBe("sealed_emergency_code_created");
});
```

Run:

```powershell
npm run test --workspace @vault/mobile -- audit-log.test.ts
```

Expected: FAIL because the new audit event type is not in `AuditEventType`.

- [ ] **Step 3: Add audit event types**

Extend `AuditEventType` in `apps/mobile/src/features/auth/audit-log.ts` with:

```ts
  | "sealed_emergency_code_created"
  | "sealed_emergency_code_revoked"
  | "sealed_emergency_code_regenerated"
```

- [ ] **Step 4: Verify Slice 1**

Run:

```powershell
npm run test --workspace @vault/mobile -- audit-log.test.ts
npm run typecheck --workspace @vault/mobile
```

Expected: both PASS.

- [ ] **Step 5: Update handoff and commit Slice 1**

Add a `2026-06-08 - Sealed Emergency Code Setup Slice 1` entry to `HANDOFF.md` recording dependency install, audit events, and verification commands.

Commit:

```powershell
git add apps/mobile/package.json package-lock.json apps/mobile/src/features/auth/audit-log.ts apps/mobile/src/features/auth/audit-log.test.ts HANDOFF.md docs/superpowers/plans/2026-06-08-sealed-emergency-code-setup.md
git commit -m "feat: prepare sealed emergency code setup"
```

## Slice 2: Emergency Grant Repository

**Files:**
- Create: `apps/mobile/src/features/vault/supabase-emergency-grant-repository.ts`
- Create: `apps/mobile/src/features/vault/supabase-emergency-grant-repository.test.ts`
- Modify: `apps/mobile/src/features/vault/index.ts`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Write failing repository tests**

Create tests proving:

```ts
await repository.saveSealedCodeGrant(sealedPackage);
expect(insertedRow).toMatchObject({
  grant_type: "sealed_emergency_code",
  status: "active",
  wrapping_algorithm: "xchacha20poly1305_ietf",
  kdf_algorithm: "argon2id",
});
expect(JSON.stringify(insertedRow)).not.toContain("K7Q9");
```

Also test `loadActiveSealedCodeGrant()` returns the active row, and `revokeActiveSealedCodeGrants()` updates active sealed-code rows to `revoked` with `revoked_at`.

Run:

```powershell
npm run test --workspace @vault/mobile -- supabase-emergency-grant-repository.test.ts
```

Expected: FAIL because the repository file does not exist.

- [ ] **Step 2: Implement repository**

Create `supabase-emergency-grant-repository.ts` with:

- row types for `emergency_key_grants`,
- `serializeEmergencyWrappedMEKPackage`,
- `deserializeEmergencyGrantRow`,
- `createSupabaseEmergencyGrantRepository(client)` exposing `loadActiveSealedCodeGrant`, `saveSealedCodeGrant`, and `revokeActiveSealedCodeGrants`.

Use `toBase64`/`fromBase64` for ciphertext, nonce, and salt. Do not include raw emergency codes in any row shape.

- [ ] **Step 3: Export repository symbols**

Add exports in `apps/mobile/src/features/vault/index.ts` for the repository factory and row/package types needed by tests.

- [ ] **Step 4: Verify Slice 2**

Run:

```powershell
npm run test --workspace @vault/mobile -- supabase-emergency-grant-repository.test.ts emergency-key-wrapping.test.ts
npm run typecheck --workspace @vault/mobile
```

Expected: both PASS.

- [ ] **Step 5: Update handoff and commit Slice 2**

Add a `2026-06-08 - Sealed Emergency Code Setup Slice 2` entry to `HANDOFF.md` with repository behavior and verification results.

Commit:

```powershell
git add apps/mobile/src/features/vault/supabase-emergency-grant-repository.ts apps/mobile/src/features/vault/supabase-emergency-grant-repository.test.ts apps/mobile/src/features/vault/index.ts HANDOFF.md
git commit -m "feat: add emergency grant repository"
```

## Slice 3: Setup Service And Vault Session Operation

**Files:**
- Create: `apps/mobile/src/features/vault/sealed-emergency-code-service.ts`
- Create: `apps/mobile/src/features/vault/sealed-emergency-code-service.test.ts`
- Modify: `apps/mobile/src/features/vault/vault-session.ts`
- Modify: `apps/mobile/src/features/vault/vault-session.test.ts`
- Modify: `apps/mobile/src/features/vault/vault-session-context.tsx`
- Modify: `apps/mobile/src/features/vault/index.ts`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Write failing setup-service tests**

Test these behaviors:

- `createSealedEmergencyCodeSetup` generates a raw code, wraps the MEK, saves a grant, logs `sealed_emergency_code_created`, and returns the raw code only in the function result.
- `regenerateSealedEmergencyCodeSetup` revokes existing active sealed-code grants before saving a replacement and logs `sealed_emergency_code_regenerated`.
- `revokeSealedEmergencyCodeSetup` revokes active grants and logs `sealed_emergency_code_revoked`.
- safe audit metadata excludes `code`, `ciphertext`, `nonce`, `salt`, `mek`, `title`, `notes`, and `fields`.

Run:

```powershell
npm run test --workspace @vault/mobile -- sealed-emergency-code-service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 2: Implement setup service**

Create a service that accepts injected `mek`, repository, audit log, code generator, and wrapper. Return:

```ts
type SealedEmergencyCodeSetupResult = {
  code: string;
  status: "pending_confirmation";
};
```

Do not persist the raw code anywhere. The caller owns volatile display state.

- [ ] **Step 3: Add narrow vault session operation**

Add a method to `VaultSession`:

```ts
createSealedEmergencyCodeSetup(repository): Promise<SealedEmergencyCodeSetupResult>
```

and matching regenerate/revoke methods if the UI needs session-owned MEK access. The method should use the session's private MEK and not expose a generic `getMek()`.

- [ ] **Step 4: Verify Slice 3**

Run:

```powershell
npm run test --workspace @vault/mobile -- sealed-emergency-code-service.test.ts vault-session.test.ts vault-session-context.test.ts
npm run typecheck --workspace @vault/mobile
```

Expected: both PASS.

- [ ] **Step 5: Update handoff and commit Slice 3**

Add a `2026-06-08 - Sealed Emergency Code Setup Slice 3` entry to `HANDOFF.md` with service/session behavior and verification results.

Commit:

```powershell
git add apps/mobile/src/features/vault/sealed-emergency-code-service.ts apps/mobile/src/features/vault/sealed-emergency-code-service.test.ts apps/mobile/src/features/vault/vault-session.ts apps/mobile/src/features/vault/vault-session.test.ts apps/mobile/src/features/vault/vault-session-context.tsx apps/mobile/src/features/vault/index.ts HANDOFF.md
git commit -m "feat: create sealed emergency code service"
```

## Slice 4: Settings UI One-Time Code Flow

**Files:**
- Modify: `apps/mobile/src/features/settings/components/emergency-access-screen.tsx`
- Modify: `apps/mobile/src/features/settings/components/emergency-access-screen.test.ts`
- Modify: `apps/mobile/app/settings/emergency-access.tsx`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Write failing UI/source tests**

Update `emergency-access-screen.test.ts` to assert:

- sealed-code setup action is no longer globally disabled,
- copy includes `Write this code down now. Sanduqkin cannot show it again after you confirm.`,
- copy includes `Regenerate code`,
- copy includes `Revoke code`,
- copy includes `Revoke unusable code`,
- source imports `usePreventScreenCapture` from `expo-screen-capture`,
- source does not put the emergency code in route params.

Run:

```powershell
npm run test --workspace @vault/mobile -- emergency-access-screen.test.ts
```

Expected: FAIL because the current shell keeps actions disabled and has no one-time code state.

- [ ] **Step 2: Implement UI states**

Refactor `EmergencyAccessScreen` to accept action props from the route:

```ts
type EmergencyAccessScreenProps = {
  activeSealedCodeStatus: "none" | "pending_confirmation" | "active" | "interrupted";
  oneTimeCode?: string | null;
  onCreateSealedCode: () => Promise<void>;
  onConfirmSealedCodeWritten: () => void;
  onRegenerateSealedCode: () => Promise<void>;
  onRevokeSealedCode: () => Promise<void>;
};
```

Keep pre-authorized kin disabled. For the one-time code component, call `usePreventScreenCapture()`.

- [ ] **Step 3: Wire route composition**

Update `apps/mobile/app/settings/emergency-access.tsx` to compose `useVaultSession`, a Supabase emergency repository when a client is available, and the screen's volatile one-time code state.

- [ ] **Step 4: Verify Slice 4**

Run:

```powershell
npm run test --workspace @vault/mobile -- emergency-access-screen.test.ts sealed-emergency-code-service.test.ts
npm run typecheck --workspace @vault/mobile
```

Expected: both PASS.

- [ ] **Step 5: Update handoff and commit Slice 4**

Add a `2026-06-08 - Sealed Emergency Code Setup Slice 4` entry to `HANDOFF.md` with UI state behavior, screen-capture protection, and verification results.

Commit:

```powershell
git add apps/mobile/src/features/settings/components/emergency-access-screen.tsx apps/mobile/src/features/settings/components/emergency-access-screen.test.ts apps/mobile/app/settings/emergency-access.tsx HANDOFF.md
git commit -m "feat: add sealed emergency code setup UI"
```

## Final Closeout

- [ ] Run focused emergency-access suite:

```powershell
npm run test --workspace @vault/mobile -- emergency-access-code.test.ts emergency-key-wrapping.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts emergency-access-screen.test.ts
```

- [ ] Run mobile typecheck:

```powershell
npm run typecheck --workspace @vault/mobile
```

- [ ] Run Expo doctor from `apps/mobile`:

```powershell
npx expo-doctor
```

- [ ] Update `HANDOFF.md` with final closeout status, known limitations, and next recommended slice.

## Self-Review Notes

- Spec coverage: setup, one-time display confirmation, interruption state, screen capture prevention, safe persistence, revoke/regenerate, audit safety, and handoff-after-slice are covered.
- Deliberate limitation: route-level live Supabase client wiring may need to follow existing app auth-client patterns discovered during implementation; if unavailable, keep repository injection testable and show a safe unavailable state.
- No kin request, release approval, backend decrypt, email, PDF, or pre-authorized kin account exchange is included.
