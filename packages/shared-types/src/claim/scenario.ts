import {
  appendSyntheticClaimAuditEvent,
  parseSyntheticClaimAuditEventInput,
  syntheticClaimAuditEventInputsEqual,
  reconcileSyntheticClaimAuditLedger,
  type SyntheticClaimAuditEventInputV1,
  type SyntheticClaimAuditEventType,
  type SyntheticClaimAuditEventV1,
} from "./audit";
import type {
  ClaimantState,
  ClaimTransitionRequestV1,
} from "./contracts";
import {
  projectClaimantPublicJourney,
  type ClaimantPublicJourneyProjectionV1,
} from "./journey";
import { evaluateClaimTransition } from "./state-machine";

export type SyntheticClaimScenarioSnapshotV1 = {
  protocol: "sanduqkin:claim:synthetic-scenario:v1";
  synthetic_only: true;
  tenant_id: string;
  case_id: string;
  current_state: ClaimantState | null;
  version: number;
  projection: ClaimantPublicJourneyProjectionV1 | null;
  ledger: readonly SyntheticClaimAuditEventV1[];
};

export type SyntheticClaimScenarioStepV1 = {
  transition: ClaimTransitionRequestV1;
  audit_event: SyntheticClaimAuditEventInputV1;
};

export type SyntheticClaimScenarioDenialReason =
  | "actor_forbidden"
  | "assurance_required"
  | "predicate_failed"
  | "transition_forbidden"
  | "previous_state_mismatch"
  | "version_conflict"
  | "audit_transition_mismatch"
  | "idempotency_conflict";

export type SyntheticClaimScenarioStepResult =
  | {
      status: "applied";
      invalidates: readonly string[];
      snapshot: SyntheticClaimScenarioSnapshotV1;
    }
  | {
      status: "duplicate";
      invalidates: readonly [];
      snapshot: SyntheticClaimScenarioSnapshotV1;
    }
  | {
      status: "denied";
      reason: SyntheticClaimScenarioDenialReason;
      invalidates: readonly [];
      snapshot: SyntheticClaimScenarioSnapshotV1;
    };

export function createSyntheticClaimScenario(input: {
  tenant_id: string;
  case_id: string;
}): SyntheticClaimScenarioSnapshotV1 {
  assertSyntheticIdentifier(input.tenant_id, "synthetic_tenant_", "tenant ID");
  assertSyntheticIdentifier(input.case_id, "synthetic_case_", "case ID");

  return {
    protocol: "sanduqkin:claim:synthetic-scenario:v1",
    synthetic_only: true,
    tenant_id: input.tenant_id,
    case_id: input.case_id,
    current_state: null,
    version: 0,
    projection: null,
    ledger: [],
  };
}

export function applySyntheticClaimScenarioStep(
  snapshot: SyntheticClaimScenarioSnapshotV1,
  step: SyntheticClaimScenarioStepV1,
): SyntheticClaimScenarioStepResult {
  assertValidSnapshot(snapshot);
  const auditEvent = parseSyntheticClaimAuditEventInput(step.audit_event);
  const duplicate = snapshot.ledger.find(
    ({ idempotency_key }) => idempotency_key === auditEvent.idempotency_key,
  );

  if (duplicate) {
    if (!isExactReplay(duplicate, step)) {
      return denied(snapshot, "idempotency_conflict");
    }
    return { status: "duplicate", invalidates: [], snapshot };
  }

  if (step.transition.previous_state !== snapshot.current_state) {
    return denied(snapshot, "previous_state_mismatch");
  }
  if (step.transition.expected_version !== snapshot.version + 1) {
    return denied(snapshot, "version_conflict");
  }
  const transitionResult = evaluateClaimTransition(step.transition);
  if (!transitionResult.allowed) {
    return denied(snapshot, transitionResult.result_class);
  }
  if (!auditMatchesTransition(snapshot, step)) {
    return denied(snapshot, "audit_transition_mismatch");
  }

  const appendResult = appendSyntheticClaimAuditEvent(
    snapshot.ledger,
    auditEvent,
  );
  if (appendResult.status !== "appended") {
    return denied(snapshot, "idempotency_conflict");
  }

  const currentState = step.transition.requested_state;
  return {
    status: "applied",
    invalidates: transitionResult.invalidates,
    snapshot: {
      ...snapshot,
      current_state: currentState,
      version: step.transition.expected_version,
      projection: projectClaimantPublicJourney(currentState),
      ledger: appendResult.ledger,
    },
  };
}

function auditMatchesTransition(
  snapshot: SyntheticClaimScenarioSnapshotV1,
  step: SyntheticClaimScenarioStepV1,
): boolean {
  const { audit_event: auditEvent, transition } = step;
  return (
    auditEvent.tenant_id === snapshot.tenant_id &&
    auditEvent.case_id === snapshot.case_id &&
    auditEvent.actor_class === transition.actor_role &&
    auditEvent.server_time === transition.server_time &&
    auditEvent.source_state === transition.previous_state &&
    auditEvent.target_state === transition.requested_state &&
    auditEventTypeMatchesTransition(
      transition.previous_state,
      transition.requested_state,
      auditEvent.event_type,
    )
  );
}

const primaryAuditEventByTransition = {
  "none->draft": "route_selected",
  "draft->identity_pending": "checklist_selected",
  "identity_pending->submitted": "upload_received",
  "submitted->owner_notified": "owner_notice_attempted",
  "owner_notified->cooldown": "cooldown_started",
  "cooldown->review_pending": "review_assigned",
  "review_pending->approved": "review_approved",
  "approved->release_ready": "package_created",
  "release_ready->released": "encrypted_package_served",
  "released->closed": "case_closed",
} as const satisfies Record<string, SyntheticClaimAuditEventType>;

function auditEventTypeMatchesTransition(
  previousState: ClaimantState | null,
  requestedState: ClaimantState,
  eventType: SyntheticClaimAuditEventType,
): boolean {
  const key = `${previousState ?? "none"}->${requestedState}`;
  const primaryEvent = (primaryAuditEventByTransition as Record<
    string,
    SyntheticClaimAuditEventType
  >)[key];
  if (primaryEvent) return eventType === primaryEvent;

  if (requestedState === "cancelled_by_owner") return eventType === "claim_cancelled";
  if (requestedState === "withdrawn_by_claimant") return eventType === "claim_cancelled";
  if (requestedState === "on_hold") return eventType === "claim_held";
  if (requestedState === "manual_review") return eventType === "review_escalated";
  if (requestedState === "rejected") return eventType === "review_rejected";
  if (requestedState === "expired") return eventType === "route_expired";
  if (requestedState === "release_suspended") return eventType === "package_suspended";
  if (previousState === "manual_review") return eventType === "review_escalated";
  return false;
}

function isExactReplay(
  existing: SyntheticClaimAuditEventV1,
  step: SyntheticClaimScenarioStepV1,
): boolean {
  const { audit_event: auditEvent, transition } = step;
  return (
    syntheticClaimAuditEventInputsEqual(existing, auditEvent) &&
    existing.source_state === transition.previous_state &&
    existing.target_state === transition.requested_state &&
    existing.actor_class === transition.actor_role &&
    existing.server_time === transition.server_time
  );
}

function assertValidSnapshot(snapshot: SyntheticClaimScenarioSnapshotV1): void {
  if (
    snapshot.protocol !== "sanduqkin:claim:synthetic-scenario:v1" ||
    snapshot.synthetic_only !== true
  ) {
    throw new Error("Unsupported or non-synthetic claimant scenario.");
  }
  assertSyntheticIdentifier(snapshot.tenant_id, "synthetic_tenant_", "tenant ID");
  assertSyntheticIdentifier(snapshot.case_id, "synthetic_case_", "case ID");

  const ledgerIssues = reconcileSyntheticClaimAuditLedger(snapshot.ledger);
  if (ledgerIssues.length > 0) {
    throw new Error(`Synthetic claimant scenario ledger is invalid: ${ledgerIssues[0]}`);
  }
  if (snapshot.version !== snapshot.ledger.length) {
    throw new Error("Synthetic claimant scenario version is inconsistent.");
  }
  const lastEvent = snapshot.ledger.at(-1);
  if ((lastEvent?.target_state ?? null) !== snapshot.current_state) {
    throw new Error("Synthetic claimant scenario state is inconsistent.");
  }
}

function assertSyntheticIdentifier(
  value: string,
  prefix: string,
  label: string,
): void {
  if (value.length <= prefix.length || !value.startsWith(prefix)) {
    throw new Error(`Synthetic claimant scenario ${label} is invalid.`);
  }
}

function denied(
  snapshot: SyntheticClaimScenarioSnapshotV1,
  reason: SyntheticClaimScenarioDenialReason,
): SyntheticClaimScenarioStepResult {
  return { status: "denied", reason, invalidates: [], snapshot };
}
