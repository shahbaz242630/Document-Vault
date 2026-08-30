# Claimant Slice 5H — offline-code V2 physical KDF probe host

Date: 2026-08-30 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-kdf-probe-host`

Starting checkpoint: `a474024` (`Add offline-code V2 KDF evidence boundary`)

## Outcome

Slice 5H adds a separate non-production Expo router root for collecting Slice 5G evidence on operator-confirmed baseline physical iOS and Android devices. It is excluded from the ordinary application router and uses separate app identities: `com.sanduqkin.mobile.claimantkdfprobe` plus scheme `sanduqkin-claimant-kdf-probe`.

One EAS profile, `claimant-offline-code-kdf-probe`, is defined for internal preview distribution only. iOS explicitly prohibits simulator builds; Android emits an internal APK. The profile is not a development client and has no submit configuration.

The probe host uses a minimal fixture checked byte-for-byte against the required locator/client-secret/KDF/public-binding fields of the frozen synthetic V2 vector and the native Slice 5F adapter to request exactly five Argon2id samples, then passes the untrusted result through Slice 5G. Unneeded synthetic private proof, wrap, MEK, challenge, and ciphertext material is not bundled. The operator-facing screen states the physical-device, nominal-thermal, low-power-disabled conditions and warns that a measurement is not production approval. It displays only the value-free run, platform, device tier, profile, aggregate sample count/median/p95, false production-approval status, and timestamps.

The host has no Supabase/provider, network, storage, authentication, claimant identity, vault, file export, or normal runtime import. It does not display the synthetic secret, salt, root, proof, individual timings, model, OS version, or native errors. Dedicated isolation owns the single probe-root exception in the earlier 5A/5F/5G runtime guards.

No EAS build, signing, submission, installation, physical-device execution, production KDF selection, hosted mutation, deployment, or external claimant activation was performed.

## Verification

- New probe build/config tests: 3 passed; focused existing/new build isolation tests: 7 passed.
- All workspaces: 1,143 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks and zero-warning lint passed.
- Unchanged web production build generated 24 pages successfully.
- API Vercel bundle, repository/GitHub Actions security, mobile secret, deterministic vectors, custody isolation, and Slice 5A/5F/5G/5H isolation checks passed.
- `git diff --check` passed.

## Open boundary

External EAS build dispatch and physical iOS/Android execution remain separate actions. A human operator must confirm the required device conditions and review captured evidence. Production parameters, client transport/runtime integration, trusted-edge activation, and every claimant approval remain blocked.
