# Sanduqkin Security Test Plan

This plan is the defensive checklist for auth, encryption, Supabase, API, and mobile storage testing. It is based on OWASP MASVS/MASTG, OWASP API Security Top 10, and Supabase RLS/API-key guidance.

## Quick Local Gates

Run these before merging security-sensitive changes:

```powershell
npm run check:security
node --test scripts/security-check.test.cjs
npm run typecheck
npm test --workspaces --if-present
```

## Mobile Storage Attacks

- Search app source and built bundles for server-only secrets: service role keys, webhook secrets, processor tokens, Resend keys.
- Confirm vault plaintext never persists in SecureStore, AsyncStorage, logs, app state snapshots, or Supabase rows.
- Confirm cached MEKs are cleared on sign-out, account reset, and account deletion.
- Confirm biometric cached MEK uses OS-backed authentication and becomes unavailable when biometric enrollment changes.
- Verify the privacy screen covers app contents when backgrounded.

## Auth Attacks

- Try short passwords, weak passwords, malformed emails, and mixed-case emails.
- Try invalid bearer tokens against every API route; expected result is controlled `401`.
- Try malformed authorization schemes such as `Basic`, missing bearer value, and extra whitespace.
- Try repeated failed logins and verify local lockout behavior.
- Test password reset with wrong recovery phrase, malformed phrase, and mismatched passwords.
- Verify sign-out clears RevenueCat identity, vault session, MEK cache, biometric cache, and signup progress.

## Encryption Attacks

- Tamper with ciphertext, nonce, asset type, and associated data; decryption must fail.
- Confirm two encryptions of the same plaintext produce different nonces/ciphertexts.
- Confirm wrong password cannot unwrap the MEK.
- Confirm recovery phrase reset rotates wrapped key material and does not store plaintext MEK remotely.
- Confirm Supabase `vault_assets` only stores `asset_type`, `ciphertext`, `nonce`, and timestamps, never plaintext fields.

## Supabase RLS Attacks

- Every created `public` table must have RLS enabled.
- `anon` must not receive table privileges for vault, audit, account deletion, or emergency access data.
- Authenticated user A must not select, update, delete, or insert rows for user B.
- `vault_key_material` must be scoped to the current user and must not expose raw MEK.
- Public views must use `security_invoker=true` or remain unexposed.
- `security definer` functions must not live in exposed schemas.

## API Attacks

- Account deletion request route:
  - No auth header: `401`.
  - Non-bearer auth header: `401`.
  - Invalid bearer token: `401`.
  - Valid bearer token: creates request for the token user only.
- Internal processor routes:
  - Missing or wrong token: `401`.
  - Valid token: processor runs.
- RevenueCat webhook:
  - Missing/wrong secret: `401`.
  - Invalid JSON: `400`.
  - Invalid payload shape: `400`.
  - Valid payload: `200`.

## Local Supabase Runtime

Docker Desktop is required.

```powershell
supabase start --workdir supabase
supabase status --workdir supabase
```

With the current local CLI, `supabase db reset --workdir supabase` may start/reset the local stack but fail to pick up this repository's migration directory. If that happens, rely on `npm run check:security` for static migration coverage and validate remote/local database state through direct SQL before release.

Useful SQL checks:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```
