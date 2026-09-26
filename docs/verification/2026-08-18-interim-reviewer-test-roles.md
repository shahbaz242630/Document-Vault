# Interim reviewer test roles

Date: 2026-08-18 (Asia/Dubai)

Decision owner: Shahbaz Malik

## Decision

Until qualified independent human reviewers are engaged for go-live preparation, the claimant review workflow may be built and exercised by the following interim test team:

- **Accountable human test reviewer:** Shahbaz Malik.
- **Non-human technical review assistant and test actor:** OpenAI Codex, operating only through owner-controlled development tooling.

This assignment applies only to synthetic engineering, staging, and separately authorized production-shaped verification while claimant capabilities remain disabled. It does not satisfy the two-independent-human-reviewer release control.

## Permitted work

- Review implementation, migrations, policies, threat controls, test fixtures, and value-free evidence.
- Generate and execute synthetic approve, reject, hold, conflict, recusal, dispute, escalation, appeal, replay, race, and outage scenarios.
- Exercise two distinct synthetic reviewer identities to prove database/API separation, blind decision sequencing, immutable decisions, and denial of duplicate approval.
- Report findings and recommend remediation to Shahbaz Malik.
- Perform value-free health, concealment, authorization-denial, rollback, and synthetic smoke checks in a separately authorized production-shaped environment.

## Prohibited authority

- Codex is not a human reviewer, legal adviser, data controller, independent assessor, or release approver.
- Codex must not receive or retain production reviewer credentials, real claimant evidence, live claimant identifiers, secrets, tokens, or private owner information.
- Codex output cannot approve or reject a real claim, satisfy either human approval, authorize package creation/release, accept residual risk on behalf of an independent assessor, or waive a launch gate.
- Shahbaz Malik alone cannot submit both live approvals. A synthetic second identity is test evidence only and must never become release authority.
- Production testing under this interim assignment may not enable claimant capabilities, collect real claimant data, create a real review decision, contact an owner/claimant/provider, or authorize retrieval/release.

## Go-live replacement gate

Before any real claimant data, external claimant access, package creation, or release capability is enabled:

1. name at least two qualified, trained, operationally independent human reviewers;
2. provision separate least-privilege identities and complete conflict/recusal and access reviews;
3. prove one identity cannot submit both decisions and that the second reviewer records an independent assessment before seeing the first decision;
4. remove or disable all interim synthetic reviewer identities and verify they have no production authority;
5. complete synthetic tabletop exercises, independent assurance, and the applicable legal/privacy/security/operations approvals.

This record changes interim testing ownership only. It does not change the release predicate, production activation lock, reviewer separation requirement, or launch status.

## Superseded in part — owner decision of 2026-09-26 (Slice 7A)

The owner decided that claim releases will have **one accountable human approver, Shahbaz Malik**, instead of two independent human reviewers. Slice 7A (`docs/superpowers/specs/2026-09-26-claimant-slice-7a-single-approver-review.md`) builds the single-approver path. The two-person path above remains in the code for later use.

What does not change:
- Claude remains a non-human engineering assistant. It is never a reviewer, approver or release authorizer of a real claim.
- In single-approver mode the database accepts a decision only from a reviewer identity of class `accountable_human_test`, never `non_human_test_actor`.
- Every identity stays synthetic-only, with live authority structurally false.

The go-live gate for single-approver cases replaces items 1–3 of "Go-live replacement gate" above. It becomes:
1. one named, trained human approver (the owner), with a separate least-privilege identity and completed conflict and access reviews;
2. hosted MFA, device security and account-recovery rules for that approver's account, because it is now the single most important credential;
3. the safeguards active:
   - automated pre-checks that can only block;
   - a minimum 30-day owner cooldown;
   - a 7-day post-approval dispute window started by a verified owner notice;
   - a fresh-MFA re-confirmation before release;
   - no self-resolution of escalations or appeals;
   - the tamper-evident audit chain;
4. an email provider for owner notices (without one, nothing can be released);
5. legal review confirming that a single approver with these safeguards is acceptable in each launch market.

Items 4 and 5 of the original gate (removing interim synthetic identities; tabletop exercises and legal, privacy, security and operations approvals) still apply.
