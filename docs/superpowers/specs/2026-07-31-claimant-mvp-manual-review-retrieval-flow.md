# Claimant MVP Manual Review And Retrieval Flow

Last updated: 2026-08-02 (Asia/Dubai)

Status: Owner-approved product journey and native local PDF boundary; `NO-GO` for runtime implementation pending specialist gates.

## Core Product Rule

Sanduqkin does not auto-release. Route verification, document completion, human approval, owner protection and retrieval authentication are separate gates. No timer, document, code, link, password or single reviewer can independently authorize release.

## Intended Journey

1. **Choose route**
   - Option 1: registered and previously verified recipient.
   - Option 2: approved future V2 emergency-code holder.
   - Route verification establishes context and possession only, not entitlement.
2. **Authenticate and verify route**
   - Verify the claimant account, fresh MFA and the route-specific invitation/key or V2 possession proof.
   - V1 sealed codes are never accepted for public lookup.
3. **Build the document checklist**
   - Ask the minimum routing questions.
   - Render the common evidence core plus the applicable signed/versioned jurisdiction-policy overlay.
   - Explain why each item is needed and allow unavailable items to enter manual review.
4. **Upload evidence securely**
   - Upload directly into a private case-bound quarantine—not email and not a broadly shared consumer drive.
   - Validate file signature/type/size/page limits, scan for malware and record the evidence version.
5. **Independent human review**
   - Two separately authenticated, qualified and conflict-checked reviewers inspect only the required evidence.
   - Each records an independent decision, safe reason code and evidence-version references.
   - Missing, conflicting, suspicious or unsupported information enters `more_information_needed`, `on_hold`, `rejected` or counsel escalation.
6. **Owner protection and release authority**
   - Complete verified owner notice, cancellation opportunity and the approved cooldown.
   - Non-response never approves release.
   - The current owner grant, two valid reviews and counsel-approved authority policy must all pass before package creation.
7. **Notify claimant**
   - Send a value-free message stating that a secure case update is available.
   - The message contains no owner identity, evidence, document filename, password, code, vault detail, countdown or release material.
   - A bounded link opens the official claimant portal; it does not itself authorize retrieval.
8. **Authenticate retrieval**
   - Require the claimant account, fresh MFA, current case authorization and route-specific cryptographic possession.
   - A server-generated/email-delivered password is not a vault decryption key and cannot replace claimant-held cryptographic custody.
9. **Retrieve and open locally**
   - The backend serves only an immutable claimant-addressed encrypted package and signed manifest.
   - Under the currently approved zero-knowledge boundary, the native claimant client decrypts locally and renders the read-only information.
   - The claimant may explicitly generate/export a PDF on the device after a clear privacy warning.
10. **Confirm and close**
    - Record separate events for retrieval authorization, encrypted-package delivery, successful local open reported by the client, explicit export confirmation and claimant confirmation.
    - Close only under the approved operations policy; reopening requires a controlled transition.

## Shared Evidence Workspace

“Shared drive” means a controlled evidence-review workspace, not a normal shared folder. It requires:

- private case-bound object storage;
- randomized object paths and no public URLs;
- least-privilege reviewer assignment;
- short-lived access capabilities;
- malware quarantine before review;
- access, view, decision, export and deletion audit events;
- no syncing to unmanaged reviewer devices;
- approved retention, deletion, backup and legal hold; and
- immediate access removal after recusal, reassignment or case closure.

The final storage/provider choice remains subject to privacy, security, residency, processor-contract and backup review.

## Browser PDF Boundary

The owner's literal proposed ending—open a normal PDF in the browser using a system-generated password—conflicts with the currently approved zero-knowledge/native-custody model if Sanduqkin generates, stores, decrypts or knows the PDF protection secret. It also increases browser cache, download-folder, extension and link-sharing exposure.

The owner-approved boundary is:

- browser for account, checklist, upload, dashboard and case communication;
- native claimant client for private-key use, package decryption, read-only viewing and optional local PDF export; and
- backend receipt events for encrypted delivery and claimant confirmation, never a claim that Sanduqkin proved the human read or permanently saved the PDF.

A browser-decrypted PDF is out of scope. It can be reconsidered only through a new explicit product/security/privacy decision with a revised threat model and proof that the decryption secret is never available to Sanduqkin infrastructure.

## Claimant Dashboard

The dashboard uses safe public states:

1. Route verification needed.
2. Documents needed.
3. Documents received and protected.
4. Under review.
5. More information needed or on hold.
6. Owner-protection checks in progress.
7. Decision recorded.
8. Secure retrieval available.
9. Case closed. Closure does not by itself prove local open, reading, export or retention.

It does not expose reviewer identity, owner response, fraud signals, internal notes, evidence-verification methods, exact security timers or release-control logic.

## Internal Audit Events

At minimum, record server-authored events for:

- route selected, verified, failed, expired or revoked;
- account/MFA assurance changes;
- checklist policy/version selected;
- upload requested, received, quarantined, scanned, rejected or deleted;
- evidence viewed and by which authorized pseudonymous reviewer identity;
- review assigned, recused, approved, rejected or escalated;
- owner notice attempted, verified or failed without logging message content;
- cancellation, hold, dispute, appeal and cooldown transitions;
- release eligibility evaluated and each failed/passed predicate;
- package version created, suspended, expired or invalidated;
- retrieval session issued, rejected or expired;
- encrypted package served;
- local-open success reported, export confirmed and claimant confirmation recorded;
- case closed, reopened, retained, held or deleted; and
- every administrative access, export, override attempt and kill-switch change.

Logs exclude vault plaintext, raw secrets, document bodies, unsafe filenames and unnecessary PII. State, outbox, dashboard and audit-event reconciliation must detect gaps or tampering.

## Truthful Receipt Language

The backend can prove that it authorized a retrieval session and served encrypted bytes. A signed client event can report that local decryption opened successfully. A claimant can explicitly confirm receipt or export. Sanduqkin must not claim that it can prove the person read, understood or retained the PDF unless a qualified policy defines a separate legally supportable acknowledgement.

## Stop Gate

Do not implement this journey until the provisional Shahbaz Malik operator/data controller designation is legally confirmed with contracting-entity/controller details and a processor map, and the policy packs, evidence catalogue, review staffing, iOS custody proof, security/privacy/legal approvals, storage provider and audit design are approved against one immutable review set.
