# Native Enrollment Adversarial Pre-Review (Slice 1B / 1C)

Date: 2026-08-12 (Asia/Dubai)

## Reviewer Status — Read First

| Field | Value |
|---|---|
| Reviewer | Claude Opus 5, acting as an adversarial technical reviewer at the owner's request |
| Relationship to the implementation | Did not author, design, or advise on any reviewed file |
| Relationship to Sanduqkin / Shahbaz Malik | Assistant engaged by the owner; no employment, contractual, or financial interest |
| Independence claim | **NOT a qualified independent reviewer for governance purposes** |

This document does **not** close the independent cryptographic, Apple-platform, or
privacy review gate defined in
`docs/superpowers/specs/2026-08-04-native-enrollment-independent-review-packet.md`.
That gate requires a qualified *person* who discloses conflicts and signs a decision.

What this document *is*: a genuinely independent adversarial pass by a reviewer that
did not write the code, with full byte-level reproduction of both vectors using
deliberately different primitives, and executable probes against the reviewed
validators. Its purpose is to remove defects **before** paid specialist review, so the
specialists spend their time on the questions only they can answer. Fifteen findings
below are new relative to the internal adversarial review of 2026-08-04.

## Inputs Verified

- Slice 1B aggregate: `4abdfb3230f96ada853f3ae096c28e8efc282cf5fbadf99e41d081a6780d3100` — **reproduced, matches**.
- Slice 1C aggregate: `a7bf764d6e4d1cc44175fadde533d73237e198b6e6680b8915b2b833306515cf` — **reproduced, matches**.
- All 25 individual file hashes — **25/25 match byte-for-byte**.
- Aggregate algorithm as documented (ordinal path sort, `<sha256><2 spaces><path>`, LF join, SHA-256 of UTF-8) — reproduced independently.

Reviewed documentation revisions: the 2026-08-04 review packet, manifest, Slice 1B
possession-proof review pack, Slice 1C App Attest contract, and the Slice 1B internal
adversarial review, as present in the working tree on 2026-08-12.

## Independent Reproduction

Environment: Node v22.23.1, Windows 11, repository-pinned dependencies.

Reproduction was performed **without importing any repository generator, helper, or
validation code**, and deliberately used different primitives so that a shared bug
could not cancel out:

| Element | Implementation under review | Independent implementation used |
|---|---|---|
| ECDH | `crypto.createECDH` | `crypto.diffieHellman` over PKCS#8/SPKI `KeyObject`s |
| HKDF | Hand-rolled extract/expand loop | `crypto.hkdfSync` (native) |
| Canonical JSON | `JSON.stringify(sortedObject)` | Hand-written byte-level serializer |

Results — **all reproduced exactly**:

- RFC 5869 A.1 and A.3 conformance of the reference KDF.
- Slice 1B: `public_key_fingerprint`, `canonical_challenge`, `challenge_digest`, `proof_key_info`, `expected_shared_secret` (verified from **both** sides of the ECDH), `expected_proof_key`, `proof_mac_input`, `proof_mac`.
- Slice 1C: `app_attest_key_id_digest`, `app_id_hash`, registration and assertion client data and their SHA-256 hashes, and the assertion's binding to the Slice 1B challenge digest.

Repository suites re-run and passing: shared-types 16/16, API 8/8, mobile 4/4,
`check:claim-vectors`, `check:claim-vector-isolation`, `check:claim-custody-isolation`,
`npm run typecheck` (exit 0), `npm run lint` (exit 0).

Runtime disconnection independently confirmed: no `DeviceCheck` / `DCAppAttestService`
import, no App Attest entitlement in `app.config.js`, no native-enrollment or
attestation route mounted in `services/api/src/index.ts`, and
`CLAIMANT_PRODUCTION_ACTIVATION_APPROVED` is a hard `const false` that environment
variables cannot override.

## What Is Genuinely Well Built

Recording this because it is load-bearing for the specialists' scope:

- **Domain separation is correct.** Three distinct versioned labels with a `0x00`
  separator, over a value space (`\x21`–`\x7e`, Base64URL, UUID) in which the
  separator byte cannot occur. Unambiguous.
- **The transcript binds both public keys.** The claimant key enters through its
  domain-separated fingerprint *and* the ECDH operation; the server ephemeral key is a
  bound field. This is the correct defence against unknown-key-share and key
  substitution, and it is done properly.
- **Encoding canonicality is genuinely enforced**, not merely length-checked. The
  trailing-bit character classes reject non-canonical Base64URL (probe D1), the X9.63
  pattern pins the leading `0x04` byte, and standard Base64 is rejected (probe D3).
- **Exact key-set validation** on every object prevents field injection.
- **The exact 300-second TTL is enforced**, not just documented.
- **`email-ascii-v1` is the strongest part of the submission.** It correctly rejects
  quoted local parts, internationalized addresses, embedded NUL, trailing-dot domains,
  single-label domains, underscores in DNS labels, and over-length local parts; folds
  case on the domain only; re-normalizes inside the index derivation; and compares in
  constant time with a length guard.

### One insight worth escalating

App Attest here is **not** merely "app integrity hardening." It is the control that
defeats key substitution by a TLS-terminating intermediary.

`EDGE-01` plans a managed WAF/CDN in front of every ingress including the API. Such a
provider terminates TLS and therefore sees the bearer token and can rewrite bodies. An
intermediary in that position could swap the claimant's `public_key` in the challenge
request for one it controls, and complete enrollment of its own key. The possession
proof alone does not stop this. The App Attest assertion does, because the genuine app
signs client data carrying the *claimant's* `public_key_fingerprint`, which will not
match the substituted value the server stored.

Two consequences: App Attest must not be treated as optional or deferrable relative to
`EDGE-01`, and the two workstreams should be sequenced together. Conversely, App Attest
does **not** defend against a fully compromised claimant session — an attacker holding
the session can register their own App Attest key on their own device. That residual
risk is the subject of SK-07.

## Findings

Severity uses the packet's scale. "Blocks" uses the packet's slice vocabulary.

---

### SK-01 — `P2` — Canonical JSON serializer is outside the frozen review boundary

- **Location:** manifest (`docs/verification/2026-08-04-native-enrollment-independent-review-manifest.md`); dependency `packages/shared-types/src/claim/canonical-json.ts`.
- **Scenario:** The bytes that are hashed into `challenge_digest` and MAC'd into `proof_mac` are produced entirely by `canonicalJson()`. That file is not among the 25 manifest entries and is not covered by either aggregate. A reviewer who approves `4abdf…` / `a7bf7…` has not frozen the function that decides what gets signed; it can be changed later without invalidating the manifest or the approval.
- **Preconditions / impact:** No exploit today. It voids the completeness of any independent approval issued against these aggregates, which is precisely what the manifest exists to prevent.
- **Remediation:** Add `canonical-json.ts` and its test to both aggregates, regenerate the manifest and both hashes, and reissue before dispatch.
- **Blocks:** the validity of the independent review itself; server verifier slice.
- **Evidence to close:** regenerated manifest listing the serializer, with recomputed aggregates.

---

### SK-02 — `P2` — "Canonical JSON" is under-specified for the cross-language client that must reproduce it

- **Location:** Slice 1B review pack, "Canonical challenge"; `canonical-json.ts`.
- **Scenario:** The spec defines canonicalization as "lexicographically sorted keys, UTF-8 encoding, safe integers only." The implementation is `JSON.stringify` over a key-sorted object, which additionally fixes string escaping (`\n`/`\t`/`\uXXXX` forms, no `/` escaping, no non-ASCII escaping), number formatting, and — via `Array.prototype.sort` — UTF-16 code-unit key ordering rather than UTF-8 byte ordering. None of that is written down. The iOS Swift client and any non-JavaScript verifier must reproduce these bytes exactly.
- **Preconditions / impact:** A Swift serializer that differs in any detail produces a MAC mismatch. The user-visible result is a bereaved claimant whose enrollment fails with a generic error, on a code path with no diagnostic (the design correctly forbids logging the transcript). Availability and supportability, not authentication bypass — the exact-key-set validation and constrained value formats make a canonicalization *collision* infeasible here.
- **Remediation (preferred):** Eliminate the dependency instead of specifying it. Have the server issue the canonical challenge as an opaque unpadded Base64URL blob; the client MACs exactly those received bytes and never re-serializes, parsing a separate copy only for display and validation. This is the WebAuthn `clientDataJSON` model, it removes an entire class of cross-language bugs, and the vector already emits `canonical_challenge`, so the change is small.
- **Remediation (alternative):** Adopt RFC 8785 JCS explicitly and add Swift-vs-TypeScript conformance vectors including non-ASCII and escape-sensitive inputs.
- **Blocks:** native adapter slice, live challenge work.
- **Evidence to close:** either the opaque-bytes transcript with a round-trip test, or JCS conformance vectors passing in both languages.

---

### SK-03 — `P2` — App Attest `expected_bundle_version` and `expected_validation_category` may not be verifiable from any Apple-provided data

- **Location:** `app-attest-contracts.ts`; `app-attest-validation.ts:188–202`; Slice 1C spec, "Apple Trust Model" and "Registration Contract".
- **Scenario:** The Slice 1C spec states the server validates "…AAGUID environment, validation category, bundle version, and receipt." App Attest authenticator data carries `rpIdHash || flags || counter || aaguid || credentialId || COSE public key`; the attestation adds the certificate chain and receipt. To the best of my determination, **none of these carries the app's bundle version, and App Attest exposes no "validation category" enum**. If that is right, both fields are server-chosen values that the server puts into client data and the client signs back — they assert nothing about the actual app build or distribution channel, and `requireValidationCategory` enforces an internal policy rule rather than an Apple fact.
- **Preconditions / impact:** No bypass. The risk is a documented control that does not exist: the design would claim verified app-version and TestFlight-vs-App-Store assurance while providing neither. Only the AAGUID (`appattestdevelop` vs production) would actually distinguish environment.
- **Stated uncertainty:** I could not verify this from first principles and the spec cites no Apple reference for the 2/3/4 mapping. **This finding is explicitly routed to the Apple-platform reviewer for confirmation or correction.**
- **Remediation:** Cite the exact Apple field and document that carries validation category and bundle version. If no such source exists, either remove both fields or rename them to make plain they are server policy tags with no attested backing, and correct the Slice 1C "Apple Trust Model" wording.
- **Blocks:** native App Attest adapter slice.
- **Evidence to close:** a citation to current Apple documentation, or a corrected contract and spec.

---

### SK-04 — `P2` — Contract layer accepts off-curve points and the point at infinity; the only negative test is trivially rejected

- **Location:** `validation.ts:15` (`x963P256Pattern`), `:65`, `:94`; `possession-proof-vector.test.ts:131–138`.
- **Scenario:** Probes A1–A3 confirm that a well-formed 65-byte `0x04 || X || Y` blob whose point lies on a *different* curve over the same prime field, and the all-zero point-at-infinity encoding, both pass `assertNativeEnrollmentChallengeRequestV1` and `assertNativeEnrollmentChallengeV1`. Validation is shape-only by design. The repository's sole off-curve test uses `0x04 || 0…0`, which every mainstream library rejects on sight; it does not exercise the actual invalid-curve attack shape.
- **Preconditions / impact:** The classic invalid-curve attack against the server's ECDH. Impact is bounded — the server key is per-challenge ephemeral, single-use, 300 s, and atomically consumed, so there is no static key to extract across queries — but the mitigation is incidental, not designed. Node rejects such points at key import (probe A4); Swift/CryptoKit and any future verifier must be *proven* to do the same rather than assumed to.
- **Remediation:** Promote point validation from prose ("Runtime code must perform full platform/library point validation") to a numbered MUST in the verifier contract: on-curve, not the identity, correct field-element length, plus explicit rejection of an all-zero ECDH result. Add negative vectors built from a genuine same-field different-curve point. Record per-library conformance evidence for every crypto stack in the path.
- **Blocks:** server verifier slice, native adapter slice.
- **Evidence to close:** invalid-curve negative vectors in the frozen set, plus per-library rejection evidence.

---

### SK-05 — `P2` — The shared fixture validator does not bind the fingerprint to the public key

- **Location:** `validation.ts:17–42` (`assertNativeEnrollmentFixtureV1`).
- **Scenario:** Probe E1 substitutes an unrelated SHA-256 value for `public_key_fingerprint` in both the challenge and the proof, leaving `challenge_request.public_key` untouched. The fixture validator accepts it. The function cross-checks nine other bindings, which makes this omission easy to read past — and it is the one binding that anchors the whole proof to the key material being enrolled.
- **Preconditions / impact:** Not exploitable as shipped: nothing consumes this at runtime, and the review pack correctly states the server computes the authoritative fingerprint and rejects client-supplied ones. The risk is misplaced assurance — the packet describes this validator as proving "cross-object bindings," and a future implementer could reasonably rely on it.
- **Remediation:** State the server obligation as a numbered MUST ("the verifier recomputes `SHA-256(label ‖ 0x00 ‖ public_key_bytes)` and compares; the client-supplied fingerprint is never trusted"), add a server-side conformance test, and either add a crypto-capable binding check outside `shared-types` or document in the validator itself why the check cannot live there.
- **Blocks:** server verifier slice.
- **Evidence to close:** server conformance test rejecting a mismatched fingerprint.

---

### SK-06 — `P2` — Address-index key custody and rotation are unspecified, unlike the ephemeral wrapping key

- **Location:** Slice 1B review pack, "Invitation Bootstrap V1" item 3; `services/api/src/claimant/invitation-address-v1.ts`.
- **Scenario:** The design is admirably strict about the AES-GCM wrapping key ("never persist the wrapping key in the same row/configuration boundary", rotation and destruction under an approved runbook) but says nothing equivalent about `address_index_key_v1`. Keyed indexing exists precisely because email addresses are enumerable; that protection collapses entirely if the key is readable from the same boundary as the invitation table. An attacker with database read plus configuration read recovers every recipient address offline against a guessable dictionary.
- **Second failure mode:** rotation is destructive. Indexes cannot be recomputed without the raw addresses, which the design deliberately does not retain. There is no documented migration path, so a compromise-driven rotation silently breaks every pending invitation.
- **Preconditions / impact:** Database + configuration disclosure yields the full recipient address list — a bereavement-context relationship graph, and among the more sensitive data the system holds.
- **Remediation:** Require custody in a KMS or secret manager on a different trust boundary from the database, matching the wrapping-key language. Document rotation as revoke-and-reissue: pending invitations under the retired key version are invalidated and reissued, with a bounded dual-read window; the per-row key version already present makes this tractable. Bound invitation lifetime so the rotation blast radius stays small.
- **Blocks:** server verifier slice, live challenge work, external access.
- **Evidence to close:** approved key-management runbook covering both the wrapping key and the address index key, plus a rotation drill.

---

### SK-07 — `P2` — App Attest key registration and claimant key enrollment are silent account-takeover primitives

- **Location:** Slice 1C spec, "Registration Contract"; Slice 1B review pack, "Server-Ephemeral And Atomicity Rules".
- **Scenario:** App Attest defeats a substituting intermediary but not a stolen portal session. An attacker holding a valid fresh-AAL2 claimant session, on their own device, can register their own App Attest key against that claimant and then enroll their own claimant device key. Both contracts define value-free audit records; neither requires anything the legitimate claimant or the owner would ever see.
- **Preconditions / impact:** Session compromise, which is a realistic threat given the direct-Supabase browser-token model still under decision in `OWEB-02`. Phase 1 Slice 5's two-independent-key requirement and owner finalization limit the payoff, so this is escalation rather than immediate takeover — but the attacker's key becomes one of the two device keys that ultimately decrypt released material, and nobody is told.
- **Remediation:** Treat App Attest key registration and claimant device-key enrollment, replacement, and revocation as security-sensitive events: require fresh AAL2 (already true for enrollment), emit a claimant-visible and owner-visible value-free security notification for each, and impose a cool-off before a newly enrolled key may participate in owner finalization or release. Cap concurrent App Attest keys per claimant and require an explicit path for legitimate reinstall and device replacement.
- **Blocks:** live challenge work, external access.
- **Evidence to close:** notification and cool-off rules in the contract, with hostile tests covering stolen-session enrollment.

---

### SK-08 — `P2` — Local-part case sensitivity will cause silent invitation failure in the real flow

- **Location:** `invitation-address-v1.ts:30`; Slice 1B review pack, "Invitation Bootstrap V1" item 2.
- **Scenario:** Probe I1 confirms `John.Doe@example.com` and `john.doe@example.com` produce different indexes. Essentially every mail provider treats local parts case-insensitively, so an owner will type the address the way a human writes it while the identity provider returns the lowercased form. The comparison fails closed with a generic error, correctly revealing nothing.
- **Preconditions / impact:** Availability and supportability, at the worst possible moment — a bereaved recipient who cannot proceed and cannot be told why, in a system whose whole premise is being reachable after the owner has died. The security reasoning for not folding is sound and should be kept; the failure handling is what is missing.
- **Remediation:** At issuance, if the local part contains uppercase, require explicit owner confirmation of the exact casing and warn that it must match exactly. On acceptance mismatch, provide a safe reissue path that does not disclose whether an invitation exists for that address. Never introduce a case-folded secondary index — that would reintroduce mailbox merging and enumeration. Plan for the support volume this will generate.
- **Blocks:** live challenge work.
- **Evidence to close:** issuance-time confirmation UX and a tested reissue path.

---

### SK-09 — `P3` — `api_audience` is bound in the assertion challenge but absent from the registration challenge

- **Location:** `app-attest-contracts.ts:4–17` vs `:26–46`.
- **Scenario:** Registration client data binds App ID, environment, bundle version, category, claimant, portal session, key-ID digest, nonce and timestamps, but not the API audience. Assertion client data binds it. A registration is therefore not pinned to a specific API deployment.
- **Impact:** Low today with a single planned API. Becomes a cross-deployment replay path if a second production-environment backend ever exists (regional origin, blue/green, failover origin under `EDGE-03`).
- **Remediation:** Add `api_audience` to the registration challenge for symmetry.
- **Blocks:** nothing; fix before the native adapter slice freezes.

---

### SK-10 — `P3` — Client-asserted capability fields are shaped like enforced properties

- **Location:** `validation.ts:126–138`.
- **Scenario:** `assertCapability` hard-checks `hardware_security_level === "secure_enclave"`, `private_key_exportable === false`, and `user_presence_binding === "transaction_bound"`. Probe G1 confirms these are accepted purely on the client's word, with no attestation involved. The documentation is explicit that this is not hardware attestation, but the code reads like enforcement, and code outlives documentation.
- **Remediation:** Rename to `claimed_hardware_security_level`, `claimed_private_key_exportable`, `claimed_user_presence_binding`, and add a comment in the validator stating these are advisory client claims that no server decision may rest on.
- **Blocks:** nothing; cheap and worth doing before external review.

---

### SK-11 — `P3` — `device_binding_digest` is 32 bytes of attacker-chosen, MAC-bound, persisted data

- **Location:** `validation.ts:64`, `:86`, `:119`.
- **Scenario:** Probe H1 confirms any 64-hex-character value is accepted. It is bound into the transcript, echoed in the proof, and persisted. The design correctly refuses to treat it as custody proof, but it remains a client-controlled 32-byte write primitive into claimant records and a stable client-chosen correlator across enrollments.
- **Remediation:** Treat as opaque untrusted context: never join, index, or emit it in telemetry, and bound its retention. Preferably replace it with a server-derived context value, which would also make the transcript field meaningful.
- **Blocks:** nothing; decide before persistence is implemented.

---

### SK-12 — `P3` — UUID version policy is inconsistent across server-generated identifiers

- **Location:** `validation.ts:12–13`, `:82–85`; `app-attest-validation.ts:16–17`.
- **Scenario:** `invitation_reference` correctly requires v4, but probe C1 confirms `challenge_id`, `claimant_id`, and `claimant_key_id` accept v1 through v8. A UUIDv1 encodes a timestamp and, historically, a MAC address.
- **Impact:** Low — unpredictability in this protocol comes from the 32-byte nonce and the fresh ephemeral key, not from `challenge_id`. It is nonetheless an avoidable metadata-leak and consistency gap in exactly the identifiers the server generates.
- **Remediation:** Require v4 for all server-generated identifiers, or document the CSPRNG source for each.
- **Blocks:** nothing.

---

### SK-13 — `P3` — `new URL()` throws a raw `TypeError`, bypassing the redacted error vocabulary

- **Location:** `validation.ts:189–195`; `app-attest-validation.ts:224–230`.
- **Scenario:** Probes F1 and F4 confirm a malformed origin or audience yields `TypeError: Invalid URL` rather than the intended `"Native enrollment origin is invalid."` / `"App Attest API audience is invalid."`. In a design that deliberately standardises on stable redacted errors, this is a distinguishable error class reaching a caller that expects one shape.
- **Remediation:** Wrap construction in try/catch and rethrow the domain error.
- **Blocks:** nothing.

---

### SK-14 — `P3` — Hand-rolled HKDF has no counter bound

- **Location:** `possession-proof-vector.test.ts:162–171`; `scripts/claim-vector-generator/native-enrollment-proof-vector.mjs:127–136`.
- **Scenario:** The expand loop increments a counter with no `counter > 255` guard. RFC 5869 caps output at 255·HashLen. At the fixed 32-byte output this is unreachable, and I verified the implementation against RFC 5869 A.1 and A.3 — it is correct. The hazard is reuse: this is the shape that gets copied into the production verifier.
- **Remediation:** Add the guard, or use `crypto.hkdfSync` in production code and keep the hand-rolled version only as the test oracle.
- **Blocks:** nothing.

---

### SK-15 — `P3` — Plus-tag aliases yield distinct invitation indexes for one physical mailbox

- **Location:** `invitation-address-v1.ts:4`, `:30`.
- **Scenario:** Probe I3 confirms `user+tag@gmail.com` and `user@gmail.com` index differently while delivering to the same mailbox. Not folding is the correct security choice — provider-specific folding would create mailbox merging. The consequence is that one human can hold multiple distinct claimant identities.
- **Impact:** None today; claimant keys and cases are per-identity. It becomes a real gap if any future rule requires two *distinct people* (the two-independent-reviewer model in Phase 3 is the obvious candidate, though that concerns reviewers rather than claimants).
- **Remediation:** Record as a known, accepted property in the decision register, and require any future "distinct humans" rule to establish distinctness by a means other than email address.
- **Blocks:** nothing.

---

## Findings Summary

| ID | Sev | Title | Blocks |
|---|---|---|---|
| SK-01 | P2 | Canonical JSON outside the frozen manifest | validity of the review; verifier |
| SK-02 | P2 | Canonicalization under-specified for cross-language client | native adapter; live challenge |
| SK-03 | P2 | Bundle version / validation category may be unverifiable | native adapter |
| SK-04 | P2 | Off-curve and infinity points accepted; weak negative test | verifier; native adapter |
| SK-05 | P2 | Fingerprint not bound to public key in shared validator | verifier |
| SK-06 | P2 | Address-index key custody and rotation unspecified | verifier; live challenge; external |
| SK-07 | P2 | Silent key registration / enrollment on a stolen session | live challenge; external |
| SK-08 | P2 | Local-part case sensitivity causes silent failure | live challenge |
| SK-09 | P3 | `api_audience` missing from registration challenge | — |
| SK-10 | P3 | Client claims shaped as enforced properties | — |
| SK-11 | P3 | Attacker-chosen `device_binding_digest` persisted | — |
| SK-12 | P3 | Inconsistent UUID version policy | — |
| SK-13 | P3 | Raw `TypeError` escapes redacted error vocabulary | — |
| SK-14 | P3 | HKDF counter bound missing | — |
| SK-15 | P3 | Plus-tag aliases index distinctly | — |

No `P0` or `P1` findings. Nothing here contradicts the internal review's own
outstanding `P0` items, which remain open and are not restated.

## Advisory Decisions

These are **advisory**, not the independent decision the packet requires.

**Native App Attest adapter slice — `APPROVED WITH CONDITIONS` (advisory).**
The binding design is sound and, per the escalation note above, is load-bearing rather
than optional. Conditions: resolve SK-03 with an Apple citation or correct the contract;
resolve SK-02 before a Swift client computes any transcript; apply SK-09.

**Server verifier / persistence slice — `APPROVED WITH CONDITIONS` (advisory).**
Conditions: SK-01 (refreeze the manifest), SK-04 (mandate and evidence point
validation), SK-05 (server-computed fingerprint as a numbered MUST), SK-06 (address-index
key custody and rotation runbook).

**Live challenge and atomic invitation acceptance — `CHANGES REQUIRED` (advisory).**
SK-06, SK-07 and SK-08 all land on this slice, and it additionally depends on gates
outside my competence and outside this review: qualified human cryptographic and Apple
review, privacy approval of delivery-token lifetime and raw-address retention, and the
paid-plan hosted MFA work. Do not open a live route on the strength of this document.

**Explicitly unapproved by this review:** external claimant access, real claimant data,
production activation, deployment, hosted MFA, notification delivery, evidence handling,
release, and any weakening of existing fresh-AAL2 enforcement.

## Recommended Sequencing

1. Apply SK-01 and refreeze both aggregates — otherwise any paid review is scoped to an incomplete file set.
2. Decide SK-02 (strongly recommend the opaque-bytes transcript). It is a small change now and expensive after a Swift client ships.
3. Apply the four `P3` code fixes (SK-09, SK-10, SK-12, SK-13) — roughly an hour, and they remove noise a paid reviewer would otherwise spend time on.
4. Write the SK-06 key-management runbook and the SK-07 security-event rules — these are design decisions the owner must make, not findings a reviewer can close.
5. Then dispatch to the qualified reviewers, with SK-03 routed explicitly to the Apple-platform reviewer as an open question.

## Reproduction

Reviewer scripts used for this pass are session-scratch and not committed. They can be
regenerated from this document: manifest hash verification, an independent transcript
reproduction using `diffieHellman` + `hkdfSync` + a hand-written serializer, and a probe
harness exercising the reviewed validators under Node type-stripping. Probe identifiers
(A1–A4, B1–B2, C1–C2, D1–D3, E1, F1–F4, G1, H1, I1–I15) are cited inline above.
