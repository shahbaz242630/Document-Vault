import type { SyntheticClaimAuditEventType } from "../../audit";
import type { ClaimantActorRole, ClaimantState } from "../../contracts";
import {
  applySyntheticClaimScenarioStep,
  createSyntheticClaimScenario,
  type SyntheticClaimScenarioSnapshotV1,
  type SyntheticClaimScenarioStepV1,
} from "../../scenario";
import { syntheticHandoffPredicates } from "./predicates";

const tenantId = "synthetic_tenant_alpha_001";
const caseId = "synthetic_case_alpha_001";

export function createSyntheticIdentityPendingScenario(): SyntheticClaimScenarioSnapshotV1 {
  let snapshot = createSyntheticClaimScenario({ tenant_id: tenantId, case_id: caseId });
  for (const step of [
    scenarioStep(1, null, "draft", "claimant", "route_selected"),
    scenarioStep(2, "draft", "identity_pending", "claimant", "checklist_selected"),
  ]) {
    const result = applySyntheticClaimScenarioStep(snapshot, step);
    if (result.status !== "applied") throw new Error("Synthetic handoff fixture path failed.");
    snapshot = result.snapshot;
  }
  return snapshot;
}

function scenarioStep(
  version: number,
  previous: ClaimantState | null,
  requested: ClaimantState,
  actor: ClaimantActorRole,
  eventType: SyntheticClaimAuditEventType,
): SyntheticClaimScenarioStepV1 {
  const suffix = String(version).padStart(3, "0");
  const serverTime = `2026-08-01T09:0${version}:00.000Z`;
  return {
    transition: {
      protocol: "sanduqkin:claim:state:v1",
      previous_state: previous,
      requested_state: requested,
      actor_role: actor,
      assurance_level: "aal2",
      expected_version: version,
      server_time: serverTime,
      predicates: syntheticHandoffPredicates,
    },
    audit_event: {
      protocol: "sanduqkin:claim:audit-event:v1",
      synthetic_only: true,
      server_authored: true,
      tenant_id: tenantId,
      case_id: caseId,
      event_id: `synthetic_event_${suffix}`,
      event_type: eventType,
      actor_class: actor,
      actor_ref: `synthetic_actor_${actor}_001`,
      server_time: serverTime,
      request_id: `synthetic_request_${suffix}`,
      correlation_id: "synthetic_correlation_handoff_001",
      idempotency_key: `synthetic_idempotency_${suffix}`,
      source_state: previous,
      target_state: requested,
      reason_class: "not_applicable",
      policy_version: "synthetic_policy_v1",
      schema_version: "synthetic_schema_v1",
      build_version: "synthetic_build_v1",
      object_ref: null,
      event_hash: `synthetic_hash_${suffix}`,
    },
  };
}
