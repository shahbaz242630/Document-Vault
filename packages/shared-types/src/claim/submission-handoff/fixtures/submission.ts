import {
  assembleSyntheticReviewSubmission,
  createSyntheticReviewSubmissionDraft,
  createSyntheticReviewSubmissionInput,
  type SyntheticReviewSubmissionEnvelopeV1,
} from "../../review-submission";
import type { SyntheticClaimScenarioStepV1 } from "../../scenario";
import type { SyntheticSubmissionHandoffInputV1 } from "../contracts";
import { syntheticHandoffPredicates } from "./predicates";
import { createSyntheticIdentityPendingScenario } from "./scenario";

export function createSyntheticSubmissionHandoffInput(): SyntheticSubmissionHandoffInputV1 {
  const snapshot = createSyntheticIdentityPendingScenario();
  const draft = {
    ...createSyntheticReviewSubmissionDraft(),
    case_ref: snapshot.case_id,
    expected_case_version: snapshot.version,
  };
  const assembly = assembleSyntheticReviewSubmission(
    createSyntheticReviewSubmissionInput({
      draft,
      current_case_version: snapshot.version,
    }),
  );
  if (assembly.status !== "assembled") {
    throw new Error("Synthetic handoff envelope fixture failed.");
  }
  return {
    envelope: assembly.envelope,
    snapshot,
    step: createSyntheticSubmissionHandoffStep(assembly.envelope, snapshot.tenant_id),
  };
}

export function createSyntheticSubmissionHandoffStep(
  envelope: SyntheticReviewSubmissionEnvelopeV1,
  tenantId: string,
): SyntheticClaimScenarioStepV1 {
  const serverTime = "2026-08-01T09:03:00.000Z";
  return {
    transition: {
      protocol: "sanduqkin:claim:state:v1",
      previous_state: "identity_pending",
      requested_state: "submitted",
      actor_role: "processor",
      assurance_level: "aal1",
      expected_version: envelope.expected_case_version + 1,
      server_time: serverTime,
      predicates: syntheticHandoffPredicates,
    },
    audit_event: {
      protocol: "sanduqkin:claim:audit-event:v1",
      synthetic_only: true,
      server_authored: true,
      tenant_id: tenantId,
      case_id: envelope.case_ref,
      event_id: "synthetic_event_submission_001",
      event_type: "upload_received",
      actor_class: "processor",
      actor_ref: "synthetic_actor_processor_001",
      server_time: serverTime,
      request_id: "synthetic_request_submission_001",
      correlation_id: "synthetic_correlation_handoff_001",
      idempotency_key: envelope.idempotency_key,
      source_state: "identity_pending",
      target_state: "submitted",
      reason_class: "not_applicable",
      policy_version: `${envelope.policy_id}_v${envelope.policy_version}`,
      schema_version: "synthetic_schema_v1",
      build_version: "synthetic_build_v1",
      object_ref: envelope.submission_ref.replace(
        "synthetic_submission_",
        "synthetic_object_submission_",
      ),
      event_hash: "synthetic_hash_submission_001",
    },
  };
}
