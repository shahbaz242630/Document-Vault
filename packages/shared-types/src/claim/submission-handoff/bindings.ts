import type { SyntheticSubmissionHandoffInputV1 } from "./contracts";

export function validateSyntheticSubmissionHandoffBindings(
  input: SyntheticSubmissionHandoffInputV1,
): "invalid_envelope" | "case_binding_mismatch" | "state_not_handoff_ready" | "version_conflict" | "step_binding_mismatch" | null {
  const { envelope, snapshot, step } = input;
  if (
    envelope.protocol !== "sanduqkin:claim:review-submission-envelope:v1" ||
    envelope.synthetic_only !== true ||
    envelope.production_approved !== false ||
    envelope.runtime_submission_authorized !== false ||
    envelope.release_authorized !== false ||
    envelope.status !== "assembled_for_review_submission"
  ) {
    return "invalid_envelope";
  }
  if (envelope.case_ref !== snapshot.case_id) return "case_binding_mismatch";

  const firstAttempt =
    snapshot.current_state === "identity_pending" &&
    snapshot.version === envelope.expected_case_version;
  const exactRetryCandidate =
    snapshot.current_state === "submitted" &&
    snapshot.version === envelope.expected_case_version + 1;
  if (!firstAttempt && !exactRetryCandidate) {
    if (!["identity_pending", "submitted"].includes(snapshot.current_state ?? "")) {
      return "state_not_handoff_ready";
    }
    return "version_conflict";
  }

  const expectedObjectRef = envelope.submission_ref.replace(
    "synthetic_submission_",
    "synthetic_object_submission_",
  );
  const expectedPolicyVersion = `${envelope.policy_id}_v${envelope.policy_version}`;
  if (
    step.transition.protocol !== "sanduqkin:claim:state:v1" ||
    step.transition.previous_state !== "identity_pending" ||
    step.transition.requested_state !== "submitted" ||
    step.transition.actor_role !== "processor" ||
    step.transition.expected_version !== envelope.expected_case_version + 1 ||
    step.audit_event.protocol !== "sanduqkin:claim:audit-event:v1" ||
    step.audit_event.synthetic_only !== true ||
    step.audit_event.server_authored !== true ||
    step.audit_event.tenant_id !== snapshot.tenant_id ||
    step.audit_event.case_id !== snapshot.case_id ||
    step.audit_event.event_type !== "upload_received" ||
    step.audit_event.actor_class !== "processor" ||
    step.audit_event.source_state !== "identity_pending" ||
    step.audit_event.target_state !== "submitted" ||
    step.audit_event.idempotency_key !== envelope.idempotency_key ||
    step.audit_event.object_ref !== expectedObjectRef ||
    step.audit_event.policy_version !== expectedPolicyVersion ||
    step.audit_event.server_time !== step.transition.server_time
  ) {
    return "step_binding_mismatch";
  }
  return null;
}
