# Slice 6B — bundled claimant runtime launch policy

Selected on 2026-09-25 after Slice 6A merged through PR #89 at `0698623`. Slice 6B adds one bundled, value-free launch-policy boundary between the normal mobile root and the disabled 6A claimant runtime bootstrap. The policy makes the application launch posture explicit: launch approval is false, feature enablement is false, and the independent kill switch is engaged.

The policy has no input and imports no adapter. It cannot read environment variables, remote configuration, network state, authentication, storage, native modules, navigation, providers or hosted services. Its frozen output identifies only a versioned bundled-default source, synthetic/non-production posture, the three launch controls, and literal-false identity/release authority. Repeated reads return the same immutable object.

The existing 6A normal mount becomes the sole policy consumer. It forwards the three fixed controls into the bootstrap and still returns inertly before reading or constructing runtime dependencies. The existing explicit synthetic bootstrap construction seam remains test-only and separately isolated; Slice 6B supplies no production runtime inputs, activation mechanism or business operations.

A dedicated static guard enforces the exact false/false/true control values, no imports or ambient adapters in the policy, exact bootstrap consumption of all three controls, and a sole-importer rule. The 6A guard is narrowed only to allow this exact policy import alongside the existing runtime foundation.

Acceptance covers exact immutable controls, one stable frozen value-free policy, unchanged dormant 6A mount behavior, mutations of every control, environment/network/provider import rejection, incomplete wiring rejection, second-importer rejection, focused tests, workspace tests/typechecks, zero-warning lint, repository security/audit/isolation checks, Expo Doctor, API bundle and web production build.

No claimant UI/navigation, environment or remote flag, hosted Auth/MFA, Supabase mutation, production native signer/custody, provider adapter, persistence, server/database/migration change, deployment, preview promotion, native/EAS build, real claimant data, journey operation exposure, intake/review/release authority, capability activation or automatic next slice is included.
