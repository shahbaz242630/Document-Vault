# Claimant Document Checklist Catalogue

Last updated: 2026-07-31 (Asia/Dubai)

Status: Product draft for legal, privacy, security and operations review. This is not legal advice, a final evidence list or release authority. No claimant intake is active.

## Design Rule

The claimant sees a minimum common checklist plus conditional items selected by an approved, versioned jurisdiction policy pack. Nationality alone never approves, rejects or releases a claim. Completing a checklist means only that the application can be reviewed.

If a document is unavailable, foreign-language, issued abroad, disputed or inconsistent, the case enters `more_information_needed`, `on_hold` or `manual_review`. It never auto-releases.

## Minimum Common Checklist

### Claimant identity

- Current government-issued photo identity document.
- Safe identity-verification result from an approved provider, where required.
- Current contact method and verified claimant account.
- Name-variation evidence only when names differ across required documents.

### Owner identification and death

- Official death certificate or approved official equivalent.
- Information needed to match the deceased owner to the Sanduqkin grant without exposing vault contents.
- Death date and issuing authority/country.

### Claimant authority or relationship

At least one policy-approved basis, depending on the claim:

- grant of probate or equivalent court/notarial authority;
- letters of administration or equivalent appointment;
- executor/administrator appointment;
- inheritance/succession certificate;
- court order;
- owner-nominated recipient/grant evidence already held by Sanduqkin; or
- relationship evidence where the applicable policy requires it.

Possessing any one document does not independently authorize release.

### Declarations and consent

- Truthful and complete submission declaration.
- Permission and notice for sensitive evidence processing.
- Confirmation that uploaded documents belong to the claim and were lawfully obtained.
- Conflict, dispute and other-known-claimant declaration.
- Acceptance of hold, further-information, appeal and fraud-investigation procedures.

## Conditional Checklist Modules

An approved policy pack may request only the modules necessary for that claim:

- will, codicil or foreign-will information;
- probate, administration, succession or notarial authority;
- marriage/civil-partnership, divorce or relationship evidence;
- birth/adoption evidence for descendant or dependent status;
- name-change evidence;
- guardianship or representative authority;
- embassy/consulate documentation;
- certified copy, apostille, legalization or attestation;
- certified translation plus translator credentials;
- proof relevant to residence, habitual residence or domicile indicators;
- asset or authority jurisdiction information;
- dispute, caveat, appeal or competing-authority documents; and
- additional counsel-approved evidence for a named policy version.

## Claim Facts Used To Select A Policy Pack

Collect only what is needed to route the case:

- country where the owner normally lived;
- country where the death occurred;
- owner nationality only where legally relevant;
- country or authority that issued the death certificate;
- known will/probate/administration status;
- country of the relevant court, notary or authority;
- claimant's claimed relationship or legal role;
- countries relevant to the requested authority or assets, where necessary;
- document language; and
- known dispute, competing claimant or court proceeding.

These are routing facts, not automatic legal conclusions.

## Document-Level Metadata

For each requested item, retain only approved metadata:

- checklist item and policy-pack version;
- issuing authority and country;
- issue/expiry dates where applicable;
- original/certified-copy status;
- translation, apostille, legalization or attestation status;
- quarantine, validation and malware-scan status;
- claimant submission time;
- reviewer access and decision references; and
- deletion, retention or legal-hold state.

Do not place document bodies, unsafe filenames, full identity numbers, vault plaintext or secrets in ordinary logs or dashboard events.

## Claimant Dashboard States

The dashboard may show safe progress such as:

1. Account verified.
2. Documents needed.
3. Documents received and protected.
4. More information needed, when applicable.
5. Application submitted.
6. Owner-protection period.
7. Independent human review.
8. Decision: approved, rejected or on hold using safe reason classes.
9. Encrypted release available, only after every later release gate passes.

It must not expose reviewer identities, fraud signals, owner contact details or responses, precise internal timers, internal notes or release-control logic.

## Rules Catalogue Requirements

Every policy pack records:

- unique ID and version;
- country/jurisdiction and applicable fact conditions;
- counsel source and accountable approver;
- effective, review and expiry dates;
- required and conditional checklist item IDs;
- accepted document forms and issuers;
- translation/attestation rules;
- unavailable-document alternatives;
- automatic hold and counsel-escalation conditions;
- retention and legal-hold mapping; and
- signature/integrity data and activation/rollback history.

There is no default global release pack. Missing, expired, conflicting or tampered rules fail closed.

## Review Questions

- Which facts determine the applicable law and authority for each intended route?
- Which evidence is genuinely necessary, and which would be excessive?
- Which foreign documents, certified copies, digital records and translations are acceptable?
- How are authenticity and issuing authority checked without giving reviewers unrestricted access?
- What alternatives exist when a legitimate claimant cannot obtain an item?
- Which inconsistencies require rejection, more information, hold, fraud escalation or counsel?
- How long is each document and its metadata retained, and how do deletion and legal hold interact?
- What explanation can safely be shown to the claimant for each requested item and decision?

## Implementation Stop Gate

Do not implement upload forms, database tables, policy engines or reviewer decisions from this draft. Shahbaz Malik is only the provisional operator/data controller candidate; first legally confirm the controller and contracting entity, complete controller contact details and the processor map, approve the intake data model, obtain counsel-approved policy packs, complete privacy/security review and authorize the bounded runtime slice.
