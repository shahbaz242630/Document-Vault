# Slice 7A — single human approver with automated pre-checks and safeguards

Proposed on 2026-09-26, after Slice 6J merged through PR #101 at `9d07c65`. Approved by the owner on 2026-09-26 with all five recommended decisions.

## Why

On 2026-09-26 the owner decided that claim releases will have **one human approver, Shahbaz Malik**, instead of two independent human reviewers. Claude runs automated pre-checks that inform his decision but is never a reviewer or an approver. The one-human decision is backed by a cooling-off period, a dispute window and a full audit trail.

The code enforces the old rule today, in several places:

- **3E** (`claimant_assign_reviewer`) fills two assignment slots with two distinct reviewer identities.
- **3F** (`claimant_record_independent_review`) needs exactly two `allow` decisions for `two_person_approved`.
- **3G** (`claimant_open_review_intervention`) requires the escalation/appeal authority to be a different person from every reviewer.
- **4A** (`claimant_authorize_release`) requires `two_person_approved`, exactly two decisions, and a final release authorizer who is neither a reviewer nor an escalation/appeal authority.
- The go-live gate in `docs/verification/2026-08-18-interim-reviewer-test-roles.md` requires two qualified independent human reviewers.

With one human, all of those checks would stop any release, so the rule has to change deliberately, in the database, with the safeguards replacing the second person.

## What already exists and is kept

These safeguards are already built. They stay, and some get stricter for single-approver cases:

- **Owner notice and cooling-off (3A–3D).**
  - The owner is notified when a claim is submitted.
  - A cooldown of 1 to 90 days runs from verified delivery.
  - The owner can cancel.
  - A claimant dispute, a material change or conflicting authority puts the case on hold.
  - A release is impossible while the cooldown is running.
- **Conflict rules.** A reviewer or authorizer can never be the case's owner or claimant.
- **Escalation and appeal (3G).** Any open intervention blocks release.
- **Release prerequisites (4A).** Release also requires the current owner finalization, two active claimant device keys and matching owner-created recipient grants.
- **Audit.** Every step writes an immutable, value-free event row, and every mutation is idempotent and version-bound.

## Scope

1. **A review mode fixed per case, chosen by the server.**
   - Each review round gains `review_mode`, either `two_person` or `single_approver`.
   - The mode comes from the case's policy pack, never from a request. A new service-only `claimant_review_policies` table holds, per policy pack, the review mode, the minimum cooldown and the dispute window. A database trigger refuses any round whose mode doesn't match the policy, and any later change of mode. Today's two-person path is kept intact for later, if more reviewers join.
   - The mode is recorded on the round and in the release authorization, so the audit shows which rule applied.

2. **Automated pre-checks, recorded before any decision.**
   - A new table, `claimant_review_prechecks`, records one pre-check run per round. It stores the check-set version, the time, a result per check and an overall outcome: `clear` or `blocking`.
   - The checks are **deterministic rules in code**, run on the server over data the system already holds. Examples:
     - evidence complete against the checklist;
     - every clean evidence object present, with a matching digest;
     - the submission receipt matches the current case version;
     - no other open claim on the same vault;
     - claimant not the owner;
     - the owner notice was verified and the cooldown has fully elapsed;
     - claimant keys and grants are current;
     - no open dispute or intervention.
   - Pre-checks are **advisory to the human and binding against release**. They can never approve anything; they can only flag or block.
   - In single-approver mode a `blocking` result cannot be overridden. The approver can only reject, hold or ask the claimant for more evidence, and a new pre-check run follows any change.

3. **Single-approver decision (changes to 3F).**
   - In `single_approver` mode the round has one assignment slot. It needs:
     - a `clear` pre-check run for the same round, taken at or after the current case version;
     - exactly one `allow` from the assigned approver;
     - a fresh-MFA session (the existing AAL2 freshness rule).
   - The aggregate becomes a new status, `single_approved`. Reject and hold behave as today.
   - The approver still can't be the owner or claimant.
   - Two-person rounds are unchanged.

4. **A dispute window after approval (changes to 4A).**
   - Approval no longer leads straight to release authorization. `single_approved` starts a **post-approval dispute window**.
   - The owner is notified again ("A claim on your vault has been approved and will be released on …"), through the existing 3A/3B/3C owner-notice path, and the window starts only from verified delivery.
   - During the window:
     - the owner can cancel;
     - the claimant, or another registered next of kin (someone else whose invitation from the same owner was accepted), can dispute;
     - any new evidence, key or grant change reopens pre-checks.

     Any of these puts the case on hold.
   - `claimant_authorize_release` for a single-approver round additionally requires:
     - the window has expired with no hold;
     - a second pre-check run, taken after the window, is `clear`;
     - the approver re-confirms with a fresh MFA session.

     The approval and the release confirmation are therefore at least the window length apart.
   - In single-approver mode, the rule that the authorizer must differ from the reviewer is replaced by these conditions. In two-person mode it stays exactly as today.

5. **Escalation and appeal in single-approver mode (changes to 3G).**
   - There is no second person to resolve them, so an escalation or appeal **holds the case**.
   - The same person may not resolve their own decision. As in 4A, any escalation or appeal on a case permanently blocks release for that case, so the only way forward is a new claim, with its own owner notice, cooldown, pre-checks and dispute window.
   - Resolving the hold may happen outside the system (for example through a solicitor); the system records only the new round.

6. **A tamper-evident audit trail.**
   - Reviewer assignment, review, pre-check, intervention, release and single-approval events for a case are chained: each event stores a SHA-256 of the previous event's hash plus its own canonical content.
   - A service-only function verifies the chain.
   - A per-case audit export (value-free: times, steps, outcomes and check versions, no evidence or keys) is added for the owner's records and any later dispute.
   - Existing events are not rewritten. The chain starts with events written after this migration.

7. **Unchanged guarantees.**
   - Everything stays synthetic-only and literal-false: `live_review_authority` and `live_release_authority` remain structurally false.
   - The service is not mounted, and no route, UI, evidence access, deployment or real data is added.
   - The reviewer console, where you would actually see a case and decide, is a later slice built against staging.

8. **Documents.**
   - `docs/verification/2026-08-18-interim-reviewer-test-roles.md` gets a superseding note. The go-live gate becomes:
     - one named, trained human approver (the owner);
     - safeguards active;
     - interim synthetic identities removed;
     - legal review of the single-approver process.
   - The four handoffs record the change.

## Acceptance

- **Single approver, happy path** (database test and service tests):
  1. The owner is notified and the cooldown runs.
  2. Pre-checks come back `clear`, and one `allow` produces `single_approved`.
  3. The owner is notified of the approval and the dispute window runs.
  4. Pre-checks run again and come back `clear`, and the approver re-confirms with fresh MFA.
  5. Release is authorized, with `review_mode: single_approver` in the record.
- **Blocked paths:**
  - a `blocking` pre-check;
  - a stale pre-check from before the latest case change;
  - a decision without a pre-check;
  - a second `allow` slot in single mode;
  - release before the window ends, or with an undelivered approval notice;
  - an owner cancellation or a claimant or next-of-kin dispute during the window;
  - new evidence during the window, which reopens pre-checks;
  - release without a fresh MFA re-confirmation;
  - an approver who is the owner or claimant;
  - an escalation or appeal, which holds the case with no self-resolution.
- **Two-person mode unchanged.** All existing 3E/3F/3G/4A database and service tests still pass unmodified.
- **Audit chain:**
  - the chain verifies end to end;
  - editing, deleting or reordering any chained event is detected;
  - the export contains no evidence, key, grant or reason text.
- **Mode is server-chosen.** A request cannot change the mode, and the mode can't change mid-case.
- **Database:**
  - every function stays `security invoker`, callable by `service_role` only;
  - the live catalog check's allowlist is updated;
  - a Docker-backed DB step runs in security CI, and I also run it locally on PGlite.
- **Checks.** Workspace tests, typecheck, lint, the security and isolation checks, and CI green.

## Owner decisions (approved 2026-09-26)

1. **What "Claude pre-checks" means in the live product. Recommended: deterministic rules in code.**
   - At runtime, the pre-checks are fixed rules written into the code (I write and test them, but no AI reads anyone's documents).
   - Having an AI read the claimant's evidence (death certificates, IDs) would send highly sensitive documents to an outside AI service. That needs a data-processing agreement, legal review and its own security design, so I'd treat it as a separate, later decision.
2. **Minimum cooling-off period for single-approver cases. Recommended: 30 days.** Today the allowed range is 1 to 90 days. With one approver, a longer minimum gives the owner (if alive) more time to object. The alternative is to keep the current 1-day minimum.
3. **Length of the post-approval dispute window. Recommended: 7 days.** A longer window is safer but delays families; a shorter one gives objectors little time.
4. **Blocking pre-checks cannot be overridden. Recommended: yes.** The alternative is to allow an override with a recorded reason. That is more flexible, but it is exactly the "one person decides alone" risk this slice is meant to reduce.
5. **Escalations and appeals hold the case, with no self-resolution. Recommended: yes.** The alternative is letting you resolve them yourself with a recorded reason.

## As built

- **Pre-checks run as one SQL function** (`claimant_run_review_precheck`) inside the database transaction, so what they read cannot change underneath them. Each run is stored with its check-set version and per-check results.
- **An account-age check was left out.** The standalone test schema has no account creation time to check it against. It can be added once hosted accounts exist.
- **The 4B and 4C changes are generated, not hand-edited.** Each is the original function with one condition changed, and a static test proves nothing else differs.
- **Time-dependent rules are tested by moving the dispute window's own timestamps.** Nothing in the database clock or the other tables is faked.

## Known limitations, recorded and not solved here

- **Owner notices depend on email.** Both the submission notice and the approval notice need the email provider, which is still to be chosen. Until it exists, no release can happen, which is the safe direction.
- **One-person risk remains.** With one approver, the main remaining risk is the approver's own account. That makes the go-live items for hosted MFA (Supabase Pro), device security and account-recovery rules more important.
- **A legal gap needs sign-off.** Legal review should confirm that a single approver, with these safeguards, is acceptable for the markets you launch in.

## Later slices

- 7B: the reviewer console (API and screen) for single-approver review, built against staging.
- The staging wiring phases W1–W2.

## Non-goals

- Reviewer UI.
- AI document review.
- Email provider selection.
- Hosted migration, deployment, real data and activation.
