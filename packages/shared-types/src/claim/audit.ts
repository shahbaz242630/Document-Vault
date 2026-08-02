import { claimantStates } from "./constants";
import type { ClaimantState } from "./contracts";

export const syntheticClaimAuditEventTypes = [
  "route_selected",
  "route_verified",
  "route_verification_failed",
  "route_expired",
  "route_revoked",
  "assurance_changed",
  "checklist_selected",
  "upload_requested",
  "upload_received",
  "upload_quarantined",
  "upload_scanned",
  "upload_rejected",
  "upload_deleted",
  "evidence_viewed",
  "review_assigned",
  "review_recused",
  "review_approved",
  "review_rejected",
  "review_escalated",
  "owner_notice_attempted",
  "owner_notice_verified",
  "owner_notice_failed",
  "claim_cancelled",
  "claim_held",
  "claim_disputed",
  "claim_appealed",
  "cooldown_started",
  "cooldown_completed",
  "release_eligibility_evaluated",
  "package_created",
  "package_suspended",
  "package_expired",
  "package_invalidated",
  "retrieval_session_issued",
  "retrieval_session_rejected",
  "retrieval_session_expired",
  "encrypted_package_served",
  "local_open_reported",
  "export_confirmed",
  "claimant_confirmation_recorded",
  "case_closed",
  "case_reopened",
  "case_retained",
  "legal_hold_applied",
  "case_deleted",
  "admin_accessed",
  "admin_exported",
  "admin_override_attempted",
  "kill_switch_changed",
] as const;

export const syntheticClaimAuditActorClasses = [
  "claimant",
  "owner",
  "processor",
  "timer_processor",
  "reviewer",
  "case_lead",
  "security",
  "administrator",
  "native_client",
  "system",
] as const;

export const syntheticClaimAuditReasonClasses = [
  "not_applicable",
  "route_invalid",
  "policy_unsupported",
  "documents_incomplete",
  "scan_failed",
  "conflict_detected",
  "authority_unconfirmed",
  "owner_cancelled",
  "claimant_withdrawn",
  "session_invalid",
  "package_stale",
  "security_hold",
  "operations_hold",
] as const;

export type SyntheticClaimAuditEventType =
  (typeof syntheticClaimAuditEventTypes)[number];
export type SyntheticClaimAuditActorClass =
  (typeof syntheticClaimAuditActorClasses)[number];
export type SyntheticClaimAuditReasonClass =
  (typeof syntheticClaimAuditReasonClasses)[number];

export type SyntheticClaimAuditEventInputV1 = {
  protocol: "sanduqkin:claim:audit-event:v1";
  synthetic_only: true;
  server_authored: true;
  tenant_id: string;
  case_id: string;
  event_id: string;
  event_type: SyntheticClaimAuditEventType;
  actor_class: SyntheticClaimAuditActorClass;
  actor_ref: string;
  server_time: string;
  request_id: string;
  correlation_id: string;
  idempotency_key: string;
  source_state: ClaimantState | null;
  target_state: ClaimantState | null;
  reason_class: SyntheticClaimAuditReasonClass;
  policy_version: string;
  schema_version: string;
  build_version: string;
  object_ref: string | null;
  event_hash: string;
};

export type SyntheticClaimAuditEventV1 = SyntheticClaimAuditEventInputV1 & {
  sequence: number;
  previous_event_hash: string | null;
};

export type SyntheticClaimAuditAppendResult =
  | {
      status: "appended";
      event: SyntheticClaimAuditEventV1;
      ledger: readonly SyntheticClaimAuditEventV1[];
    }
  | {
      status: "duplicate";
      event: SyntheticClaimAuditEventV1;
      ledger: readonly SyntheticClaimAuditEventV1[];
    };

const inputKeys = [
  "actor_class",
  "actor_ref",
  "build_version",
  "case_id",
  "correlation_id",
  "event_hash",
  "event_id",
  "event_type",
  "idempotency_key",
  "object_ref",
  "policy_version",
  "protocol",
  "reason_class",
  "request_id",
  "schema_version",
  "server_authored",
  "server_time",
  "source_state",
  "synthetic_only",
  "target_state",
  "tenant_id",
] as const;

export function appendSyntheticClaimAuditEvent(
  ledger: readonly SyntheticClaimAuditEventV1[],
  value: unknown,
): SyntheticClaimAuditAppendResult {
  const existingIssues = reconcileSyntheticClaimAuditLedger(ledger);
  if (existingIssues.length > 0) {
    throw new Error(`Synthetic audit ledger is invalid: ${existingIssues[0]}`);
  }

  const input = parseSyntheticClaimAuditEventInput(value);
  const duplicate = ledger.find(
    ({ idempotency_key }) => idempotency_key === input.idempotency_key,
  );

  if (duplicate) {
    if (!syntheticClaimAuditEventInputsEqual(duplicate, input)) {
      throw new Error("Conflicting synthetic audit idempotency key.");
    }
    return { status: "duplicate", event: duplicate, ledger: [...ledger] };
  }

  if (ledger.some(({ event_id }) => event_id === input.event_id)) {
    throw new Error("Duplicate synthetic audit event ID.");
  }
  if (ledger.some(({ event_hash }) => event_hash === input.event_hash)) {
    throw new Error("Duplicate synthetic audit event hash.");
  }

  const previous = ledger.at(-1);
  if (previous && Date.parse(input.server_time) < Date.parse(previous.server_time)) {
    throw new Error("Synthetic audit server time cannot move backwards.");
  }

  const event: SyntheticClaimAuditEventV1 = {
    ...input,
    sequence: ledger.length + 1,
    previous_event_hash: previous?.event_hash ?? null,
  };
  return { status: "appended", event, ledger: [...ledger, event] };
}

export function reconcileSyntheticClaimAuditLedger(
  ledger: readonly SyntheticClaimAuditEventV1[],
): string[] {
  const issues: string[] = [];
  const eventIds = new Set<string>();
  const hashes = new Set<string>();
  const idempotencyKeys = new Set<string>();
  const first = ledger[0];

  for (const [index, event] of ledger.entries()) {
    try {
      parseSyntheticClaimAuditEvent(event);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "Invalid audit event.");
      continue;
    }

    if (first && (event.tenant_id !== first.tenant_id || event.case_id !== first.case_id)) {
      issues.push(`Event ${event.event_id} crosses the synthetic case boundary.`);
    }
    if (event.sequence !== index + 1) {
      issues.push(`Event ${event.event_id} has a sequence gap.`);
    }
    const expectedPreviousHash = index === 0 ? null : ledger[index - 1]?.event_hash;
    if (event.previous_event_hash !== expectedPreviousHash) {
      issues.push(`Event ${event.event_id} breaks the integrity chain.`);
    }
    if (index > 0 && Date.parse(event.server_time) < Date.parse(ledger[index - 1]!.server_time)) {
      issues.push(`Event ${event.event_id} moves server time backwards.`);
    }
    addDuplicateIssue(eventIds, event.event_id, "event ID", issues);
    addDuplicateIssue(hashes, event.event_hash, "event hash", issues);
    addDuplicateIssue(
      idempotencyKeys,
      event.idempotency_key,
      "idempotency key",
      issues,
    );
  }

  return issues;
}

export function parseSyntheticClaimAuditEventInput(
  value: unknown,
): SyntheticClaimAuditEventInputV1 {
  assertPlainObject(value);
  assertExactKeys(value, inputKeys);
  assertCommonEventFields(value);
  return value as SyntheticClaimAuditEventInputV1;
}

export function syntheticClaimAuditEventInputsEqual(
  left: SyntheticClaimAuditEventInputV1,
  right: SyntheticClaimAuditEventInputV1,
): boolean {
  return inputKeys.every((key) => left[key] === right[key]);
}

function parseSyntheticClaimAuditEvent(value: unknown): SyntheticClaimAuditEventV1 {
  assertPlainObject(value);
  assertExactKeys(value, [...inputKeys, "previous_event_hash", "sequence"]);
  assertCommonEventFields(value);
  if (
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1
  ) {
    throw new Error("Synthetic audit sequence must be a positive integer.");
  }
  if (
    value.previous_event_hash !== null &&
    !hasSyntheticPrefix(value.previous_event_hash, "synthetic_hash_")
  ) {
    throw new Error("Synthetic audit previous hash is invalid.");
  }
  return value as SyntheticClaimAuditEventV1;
}

function assertCommonEventFields(value: Record<string, unknown>): void {
  if (value.protocol !== "sanduqkin:claim:audit-event:v1") {
    throw new Error("Unsupported synthetic audit protocol.");
  }
  if (value.synthetic_only !== true || value.server_authored !== true) {
    throw new Error("Claim audit fixtures must remain synthetic and server-authored.");
  }

  assertPrefixedString(value.tenant_id, "synthetic_tenant_", "tenant ID");
  assertPrefixedString(value.case_id, "synthetic_case_", "case ID");
  assertPrefixedString(value.event_id, "synthetic_event_", "event ID");
  assertPrefixedString(value.actor_ref, "synthetic_actor_", "actor reference");
  assertPrefixedString(value.request_id, "synthetic_request_", "request ID");
  assertPrefixedString(
    value.correlation_id,
    "synthetic_correlation_",
    "correlation ID",
  );
  assertPrefixedString(
    value.idempotency_key,
    "synthetic_idempotency_",
    "idempotency key",
  );
  assertPrefixedString(value.event_hash, "synthetic_hash_", "event hash");
  assertPrefixedString(value.policy_version, "synthetic_", "policy version");
  assertPrefixedString(value.schema_version, "synthetic_", "schema version");
  assertPrefixedString(value.build_version, "synthetic_", "build version");

  if (
    value.object_ref !== null &&
    !hasSyntheticPrefix(value.object_ref, "synthetic_object_")
  ) {
    throw new Error("Synthetic audit object reference is invalid.");
  }
  if (
    typeof value.server_time !== "string" ||
    !Number.isFinite(Date.parse(value.server_time))
  ) {
    throw new Error("Synthetic audit server time is invalid.");
  }
  if (!syntheticClaimAuditEventTypes.includes(value.event_type as SyntheticClaimAuditEventType)) {
    throw new Error("Synthetic audit event type is not allowlisted.");
  }
  if (!syntheticClaimAuditActorClasses.includes(value.actor_class as SyntheticClaimAuditActorClass)) {
    throw new Error("Synthetic audit actor class is not allowlisted.");
  }
  if (!syntheticClaimAuditReasonClasses.includes(value.reason_class as SyntheticClaimAuditReasonClass)) {
    throw new Error("Synthetic audit reason class is not allowlisted.");
  }
  assertClaimantState(value.source_state, "source state");
  assertClaimantState(value.target_state, "target state");
}

function assertClaimantState(value: unknown, label: string): void {
  if (value !== null && !claimantStates.includes(value as ClaimantState)) {
    throw new Error(`Synthetic audit ${label} is invalid.`);
  }
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Synthetic audit event must be an object.");
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  const missing = allowedKeys.find((key) => !(key in value));
  if (unexpected) {
    throw new Error(`Synthetic audit event contains forbidden field: ${unexpected}.`);
  }
  if (missing) {
    throw new Error(`Synthetic audit event is missing field: ${missing}.`);
  }
}

function assertPrefixedString(value: unknown, prefix: string, label: string): void {
  if (!hasSyntheticPrefix(value, prefix)) {
    throw new Error(`Synthetic audit ${label} is invalid.`);
  }
}

function hasSyntheticPrefix(value: unknown, prefix: string): value is string {
  return typeof value === "string" && value.length > prefix.length && value.startsWith(prefix);
}

function addDuplicateIssue(
  seen: Set<string>,
  value: string,
  label: string,
  issues: string[],
): void {
  if (seen.has(value)) {
    issues.push(`Duplicate synthetic audit ${label}: ${value}.`);
  }
  seen.add(value);
}
