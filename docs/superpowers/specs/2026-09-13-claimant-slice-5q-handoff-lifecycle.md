# Slice 5Q — synthetic authenticated handoff lifecycle

Chosen on 2026-09-13 after Slice 5P merged in PR #73 (`b6cd577`). The earlier local 5P staging note is preserved as historical evidence; it does not prove the previously blocked handoff-route smoke passed before merge.

Add a separate literal-false mobile composition root for the existing 5P handoff transport and coordinator. Dependencies remain injected. The root may run only during a synchronously established foreground claimant scope; it never imports the normal app, ambient network, authentication, storage, or a production native signer.

An inactive/background event cancels the in-flight operation, clears bounded completion retry, suppresses late results, and requires a new foreground event before a fresh attempt. Lock, session end, disable, malformed or regressing lifecycle events close the scope permanently. Explicit cancellation has the same local invalidation semantics. Disposal must be awaitable even when called reentrantly from an adapter, and no lifecycle event may start or retry work automatically. The snapshot contains only value-free status and false authority fields. The server and the 5P coordinator remain authoritative for account/session binding, expiry and identical completion retries.

Acceptance: disabled dependency non-access; invalid composition fail-closed; exact injected issue/sign/complete success; foreground gating; hostile event ordering; late issue/sign/complete suppression; same-foreground retry versus background invalidation; session change; overlap; reentrant disposal; static no-import/no-activation isolation, typecheck, focused regression, lint and security checks.

No UI integration, production signer/Swift method, persistent custody, hosted mutation, native/EAS build, capability activation, real claimant data, or downstream intake/review/release behavior is included. Separate protected-preview handoff-route smoke remains an evidence gap to close before any future activation claim.
