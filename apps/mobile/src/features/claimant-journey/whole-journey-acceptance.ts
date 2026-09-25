import {
  applySyntheticClaimScenarioStep,
  applySyntheticSubmissionHandoff,
  createSyntheticSubmissionHandoffInput,
  reconcileSyntheticClaimAuditLedger,
  syntheticHandoffPredicates,
  type ClaimantActorRole,
  type ClaimantState,
  type SyntheticClaimAuditEventType,
  type SyntheticClaimScenarioSnapshotV1,
  type SyntheticClaimScenarioStepV1,
} from "@vault/shared-types";
import { z } from "zod";

import { createClaimantSessionJourneyComposition } from "./session-journey-composition";

export const CLAIMANT_WHOLE_JOURNEY_ACCEPTANCE_APPROVED = false as const;

type JourneyInput = Parameters<typeof createClaimantSessionJourneyComposition>[0];
type StartInput = Parameters<ReturnType<typeof createClaimantSessionJourneyComposition>["start"]>[0];
type Input = Readonly<{
  approved?: boolean;
  syntheticOnly: true;
  productionRuntime: false;
  journey: Omit<JourneyInput, "approved" | "syntheticOnly" | "productionRuntime">;
}>;
type Status = "disabled" | "ready" | "working" | "accepted" | "unavailable" | "closed";

const safeDraftSchema = z.strictObject({
  state: z.literal("draft"), route_profile: z.literal("offline_code_v2"), case_version: z.literal(1),
  claimant_session_bound: z.literal(true), case_created: z.literal(true), identity_verified: z.literal(false),
  relationship_verified: z.literal(false), intake_started: z.literal(false), review_started: z.literal(false),
  release_authorized: z.literal(false),
});

const path = [
  ["owner_notified", "processor", "owner_notice_attempted"],
  ["cooldown", "processor", "cooldown_started"],
  ["review_pending", "timer_processor", "review_assigned"],
  ["approved", "processor", "review_approved"],
  ["release_ready", "processor", "package_created"],
  ["released", "claimant", "encrypted_package_served"],
  ["closed", "processor", "case_closed"],
] as const satisfies readonly (readonly [ClaimantState, ClaimantActorRole, SyntheticClaimAuditEventType])[];

export class ClaimantWholeJourneyAcceptanceUnavailableError extends Error {
  constructor() {
    super("Claimant whole-journey acceptance is unavailable.");
    this.name = "ClaimantWholeJourneyAcceptanceUnavailableError";
  }
}

function reject<T>(): Promise<T> {
  return Promise.reject(new ClaimantWholeJourneyAcceptanceUnavailableError());
}

function safeState(status: Status) {
  return Object.freeze({ status, accepted: status === "accepted", final_state: status === "accepted" ? "closed" : null,
    claimant_session_bound: status === "accepted", identity_verified: false as const,
    relationship_verified: false as const, release_authorized: false as const,
    decryption_authorized: false as const, runtime_effect: false as const });
}

function inert(status: "disabled" | "closed") {
  return Object.freeze({ activatePortal: (_key: string) => reject(), retryActivation: () => reject(),
    run: (_value: StartInput) => reject(), retryProof: (_key: string) => reject(),
    retryCompletion: (_key: string) => reject(), revokePortal: (_key: string) => reject<void>(),
    retryRevoke: () => reject<void>(), cancel() {}, dispose: () => Promise.resolve(),
    snapshot: () => safeState(status) });
}

function scenarioStep(snapshot: SyntheticClaimScenarioSnapshotV1, requested: ClaimantState,
  actor: ClaimantActorRole, eventType: SyntheticClaimAuditEventType): SyntheticClaimScenarioStepV1 {
  const version = snapshot.version + 1;
  const suffix = String(version).padStart(3, "0");
  const serverTime = `2026-09-15T12:${String(version).padStart(2, "0")}:00.000Z`;
  return { transition: { protocol: "sanduqkin:claim:state:v1", previous_state: snapshot.current_state,
    requested_state: requested, actor_role: actor, assurance_level: "aal2", expected_version: version,
    server_time: serverTime, predicates: syntheticHandoffPredicates }, audit_event: {
    protocol: "sanduqkin:claim:audit-event:v1", synthetic_only: true, server_authored: true,
    tenant_id: snapshot.tenant_id, case_id: snapshot.case_id, event_id: `synthetic_event_5w_${suffix}`,
    event_type: eventType, actor_class: actor, actor_ref: `synthetic_actor_5w_${actor}`,
    server_time: serverTime, request_id: `synthetic_request_5w_${suffix}`,
    correlation_id: "synthetic_correlation_5w_001", idempotency_key: `synthetic_idempotency_5w_${suffix}`,
    source_state: snapshot.current_state, target_state: requested, reason_class: "not_applicable",
    policy_version: "synthetic_policy_v1", schema_version: "synthetic_schema_v1",
    build_version: "synthetic_build_v1", object_ref: null, event_hash: `synthetic_hash_5w_${suffix}` } };
}

function finishScenario() {
  const submitted = applySyntheticSubmissionHandoff(createSyntheticSubmissionHandoffInput());
  if (submitted.status !== "applied") throw new Error();
  let snapshot = submitted.snapshot;
  for (const [requested, actor, eventType] of path) {
    const result = applySyntheticClaimScenarioStep(snapshot, scenarioStep(snapshot, requested, actor, eventType));
    if (result.status !== "applied") throw new Error();
    snapshot = result.snapshot;
  }
  if (snapshot.current_state !== "closed" || snapshot.version !== 10 || snapshot.ledger.length !== 10
    || reconcileSyntheticClaimAuditLedger(snapshot.ledger).length !== 0) throw new Error();
  return Object.freeze({ status: "accepted" as const, synthetic_only: true as const,
    route_profile: "offline_code_v2" as const, final_state: "closed" as const, case_version: snapshot.version,
    audit_event_count: snapshot.ledger.length, claimant_session_bound: true as const,
    audit_reconciled: true as const, identity_verified: false as const,
    relationship_verified: false as const, release_authorized: false as const,
    decryption_authorized: false as const, runtime_effect: false as const });
}

class WholeJourneyAcceptance {
  private readonly journey: ReturnType<typeof createClaimantSessionJourneyComposition>;
  private status: Status = "ready";
  private active = false;
  private report: ReturnType<typeof finishScenario> | null = null;

  constructor(input: Input) {
    if (input.syntheticOnly !== true || input.productionRuntime !== false) throw new Error();
    this.journey = createClaimantSessionJourneyComposition({ approved: true, syntheticOnly: true,
      productionRuntime: false, ...input.journey });
    if (this.journey.snapshot().status === "closed") this.status = "closed";
  }

  private async execute(operation: () => Promise<unknown>) {
    if (this.active || this.status === "closed" || this.report)
      throw new ClaimantWholeJourneyAcceptanceUnavailableError();
    this.active = true; this.status = "working";
    try {
      const rawDraft = await operation();
      if (!rawDraft || typeof rawDraft !== "object" || !Object.isFrozen(rawDraft)) throw new Error();
      safeDraftSchema.parse(rawDraft);
      this.report = finishScenario(); this.status = "accepted"; return this.report;
    } catch {
      this.status = this.journey.snapshot().status === "closed" ? "closed" : "unavailable";
      throw new ClaimantWholeJourneyAcceptanceUnavailableError();
    } finally { this.active = false; }
  }

  private async delegate(operation: () => Promise<unknown>, closeAfter = false,
    allowAccepted = false): Promise<void> {
    if (this.status === "closed" || (this.report && !allowAccepted))
      throw new ClaimantWholeJourneyAcceptanceUnavailableError();
    try {
      await operation(); this.status = closeAfter ? "closed" : "ready";
    } catch {
      this.status = this.journey.snapshot().status === "closed" ? "closed" : "unavailable";
      throw new ClaimantWholeJourneyAcceptanceUnavailableError();
    }
  }

  activatePortal(key: string) { return this.delegate(() => this.journey.activatePortal(key)); }
  retryActivation() { return this.delegate(() => this.journey.retryActivation()); }
  run(value: StartInput) { return this.execute(() => this.journey.start(value)); }
  retryProof(key: string) { return this.execute(() => this.journey.retryProof(key)); }
  retryCompletion(key: string) { return this.execute(() => this.journey.retryCompletion(key)); }
  revokePortal(key: string) { return this.delegate(() => this.journey.revokePortal(key), true, true); }
  retryRevoke() { return this.delegate(() => this.journey.retryRevoke(), true, true); }
  cancel(): void {
    this.journey.cancel();
    if (!this.report) this.status = this.journey.snapshot().status === "closed" ? "closed" : "ready";
  }
  async dispose(): Promise<void> { this.status = "closed"; await this.journey.dispose(); }
  snapshot() { return safeState(this.status); }
}

export function createClaimantWholeJourneyAcceptanceHarness(input: Input) {
  const approved = input.approved ?? CLAIMANT_WHOLE_JOURNEY_ACCEPTANCE_APPROVED;
  if (!approved) return inert("disabled");
  try {
    const harness = new WholeJourneyAcceptance(input);
    if (harness.snapshot().status === "closed") return inert("closed");
    return Object.freeze({ activatePortal: harness.activatePortal.bind(harness),
      retryActivation: harness.retryActivation.bind(harness), run: harness.run.bind(harness),
      retryProof: harness.retryProof.bind(harness), retryCompletion: harness.retryCompletion.bind(harness),
      revokePortal: harness.revokePortal.bind(harness), retryRevoke: harness.retryRevoke.bind(harness),
      cancel: harness.cancel.bind(harness), dispose: harness.dispose.bind(harness),
      snapshot: harness.snapshot.bind(harness) });
  } catch { return inert("closed"); }
}
