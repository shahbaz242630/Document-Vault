# Claimant Slice 1E Server App Attest Verifier And Persistence

Date: 2026-08-12 (Asia/Dubai)

## Result

The bounded Slice 1E server code is complete locally and remains unmounted and
hard-disabled. It verifies Apple App Attest registration/assertion structures and
persists only verified key state through service-role-only transactions. It creates no
route, challenge issuer, invitation acceptance path, external runtime, or production
activation.

Slice status is `LOCAL CODE COMPLETE / APPLE FIXTURE AND INTEGRATION EVIDENCE PENDING`.
The pinned-root adapter is implemented, but no Apple-issued attestation/certificate
fixture was available or authorized for this local synthetic slice. An Apple-side
specialist must run the exact immutable code against Apple validation fixtures and the
Slice 1D physical output before a challenge route may consume it.

## Implemented Boundary

- Bounded strict CBOR decoder rejects indefinite lengths, non-minimal integers,
  duplicate keys, unsupported tags/simple values, excessive depth/collections, invalid
  UTF-8, trailing bytes, and oversized objects.
- Registration verification requires the exact `apple-appattest` object, ordered leaf-
  first certificate array, bounded receipt, expected RP ID, counter `0`, environment
  AAGUID, 32-byte credential/key ID, exact P-256 COSE key, and key-ID/public-key hash.
- Assertion verification requires the exact assertion object, stored P-256 public key,
  valid ECDSA-SHA256 signature, expected RP ID, and a strictly increasing UInt32 counter.
- Both flows require fresh server-owned challenge bytes and fail closed unless the
  authenticator-data extensions contain exactly
  `apple_validation_category_01` (`UInt32`, allowed V1 values 2/3/4) and
  `apple_bundle_version_01` (`String`) matching the server challenge.
- Development verification uses Apple's currently documented `appattestsandbox`
  AAGUID; production uses `appattest` plus seven zero bytes.
- The offline Apple trust adapter accepts a caller-pinned root certificate, validates
  every certificate's time window and signature chain without an ambient trust store,
  extracts OID `1.2.840.113635.100.8.2` through a bounded DER parser, compares the
  embedded nonce in constant time, and returns only the leaf P-256 public point.
- Persistence stores the verified SPKI public key, bounded Apple receipt, environment,
  App ID hash, attested bundle/category, latest assertion bundle/category, and counter.
  It never stores an App Attest private key, raw attestation, raw assertion, or challenge.
- Registration and counter advancement are separate advisory-locked, idempotent
  transactions. Advancement requires the exact active claimant portal session, an
  active claimant device key, the expected stored counter, and a greater verified
  counter.
- Both tables use forced RLS, explicit client deny policies, zero anon/authenticated
  grants, narrow service-role grants, and append-only value-free events.
- The TypeScript persistence adapter accepts verifier result types, allowlists RPC
  fields/results, and redacts database messages.

Apple's current primary server-validation documentation explicitly places the bundle
version and validation category in the authenticator-data CBOR extensions dictionary;
they are therefore active mandatory controls, not inert client claims.

## Non-Goals And Remaining Gates

- No Apple root certificate is committed or selected by this slice. Root provenance,
  rotation, expiry monitoring, and immutable configuration require separate review.
- No Apple-issued certificate chain, attestation, assertion, receipt, fraud metric,
  native compile, or physical-device evidence was used.
- No route or challenge database exists. No verifier input can currently arrive from a
  client, and no persistence call is mounted in the API.
- No production Supabase migration, hosted configuration, Apple provider change,
  entitlement change, deployment, external access, or real claimant data was used.
- Receipt retention, fraud-assessment processing, privacy/legal authority, and deletion
  policy remain pre-live gates.

## Verification

- Focused server verifier/persistence tests: 8 passed across 3 files.
- Live local PostgreSQL transaction test passed, including registration, counter
  advance, replay rejection, exact event count, and append-only event enforcement.
- Supabase catalog security and hostile RLS checks passed with both new tables and RPCs
  explicitly inventoried.
- Repository security guard and its static tests passed.
- API typecheck and focused lint passed.
- Full workspace verification and final aggregate are recorded after the final pass.

## Exact Code Snapshot

Aggregate SHA-256: `487fde48826eb9a19a5779742108ee6cc4046177bd7b77facf37741517fdf5cc`

Aggregate algorithm: ordinal path sort; SHA-256 each complete file; serialize
`<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization.

| Path | SHA-256 |
| --- | --- |
| `.github/workflows/security-ci.yml` | `19de646a858077a46b45265165c37147740f5379138eabd3bfd2903411d534bc` |
| `package.json` | `c66631af918f1755d83ae42baecc22791ac1b131e3df36e8527c5e3e49099ac4` |
| `scripts/claimant-app-attest-persistence-db-test.cjs` | `0fbbab53b78228157102757a7b57ecfb41eaedc2a5eeba9fa439cf10e7e70940` |
| `scripts/claimant-app-attest-persistence-migration.test.cjs` | `5b7f12c5f4d43e8805f8720faca95f8b74086b2c0b18288ff0e49cdf63f8e96f` |
| `scripts/supabase-db-security-check.cjs` | `b4076de1481308569bcb09dcd04768c26ac6ca87762d07f60807c171825a62fc` |
| `scripts/supabase-db-security-check.test.cjs` | `dc75318b7ce8f3a237db0b94b3efca1780c1e70f02ccd5078188dce0c3aae993` |
| `services/api/src/claimant/app-attest-certificate-trust.test.ts` | `68b88edb6c0146cdec62d084ebcf5afb715991a5ccfe42a34c31ea5268e12e69` |
| `services/api/src/claimant/app-attest-certificate-trust.ts` | `bf2bc110e6ec575b1bd5db51470dc4f71cad085a6f93ba152e4f925b97d4411b` |
| `services/api/src/claimant/app-attest-persistence-client.test.ts` | `12d0ba0604574093982091e7310d4e5e742310e768ecf4b44c388dad041b559f` |
| `services/api/src/claimant/app-attest-persistence-client.ts` | `c3d8dc701ea7451b4409bb86bcffe4f19690d906ccf8e4675f08e731a188b08c` |
| `services/api/src/claimant/app-attest-verifier.test.ts` | `fe452b1c595141999e312652b1b96b07345539e91506d89b1f71d2ae1f04e9f0` |
| `services/api/src/claimant/app-attest-verifier.ts` | `98b447575bee34c07ab51f521bc39d6e8f255fbf8d8af5e798e43cdf9b7380a6` |
| `services/api/src/claimant/strict-cbor.ts` | `bc07fd43d6bcdc1a8d27f1117544b2a1c9987abfa7f0be1dcdd37eb607804bae` |
| `supabase/migrations/20260812130000_claimant_app_attest_persistence.sql` | `3a6d78c38767f113e30dc6276517d57bed2a350c956264ee81465d0b57672550` |

## Exit Work

1. Pin the reviewed Apple App Attest root certificate through protected server
   configuration and record its provenance/fingerprint/rotation owner.
2. Run Apple validation-guide fixtures plus exact Slice 1D device output through this
   verifier; exercise development and authorized distribution categories separately.
3. Independently review CBOR/DER parsing, PKIX assumptions, signature semantics,
   extension policy, receipt handling, counter races, and error behavior.
4. Only after that evidence passes, implement a separate disabled transactional
   challenge issuance/consumption slice with single-use expiry and bind it to the
   invitation/native-enrollment transaction.

Any source change requires new hashes and a repeat of all applicable checks.
