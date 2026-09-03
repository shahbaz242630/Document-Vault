import {
  canonicalJson,
  claimantStates,
  projectClaimantPublicDecisionReadiness,
  projectClaimantPublicJourney,
  projectClaimantPublicReviewTracking,
  type ClaimantPublicDecisionReadinessProjectionV1,
  type ClaimantPublicJourneyProjectionV1,
  type ClaimantPublicReviewTrackingProjectionV1,
} from "@vault/shared-types";

export const CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED = false as const;

export type ClaimantDashboardReadModelV1 = Readonly<{
  case_id: string;
  case_version: number;
  decision_readiness: ClaimantPublicDecisionReadinessProjectionV1;
  journey: ClaimantPublicJourneyProjectionV1;
  last_meaningful_update_date: string;
  projection_version: number;
  protocol: "sanduqkin:claim:dashboard-read-model:v1";
  review_tracking: ClaimantPublicReviewTrackingProjectionV1;
  support_route: "secure_case_support";
  synthetic_only: true;
}>;

export type ClaimantDashboardReadModelTransportV1 = Readonly<{
  read(input: Readonly<{
    caseId: string;
    knownProjectionVersion: number | null;
    signal?: AbortSignal;
  }>): Promise<ClaimantDashboardReadModelV1>;
}>;

export class ClaimantDashboardCoordinatorError extends Error {
  constructor(readonly kind: "aborted" | "busy" | "disabled" | "divergent_response" |
    "failed" | "invalid_input" | "invalid_response" | "stale_response") {
    super("Claimant dashboard could not be loaded.");
    this.name = "ClaimantDashboardCoordinatorError";
  }
}

type CoordinatorInput = Readonly<{
  approved?: boolean;
  now?: () => Date;
  onChange?: (snapshot: ClaimantDashboardReadModelV1 | null) => void;
  transport: ClaimantDashboardReadModelTransportV1;
}>;

export function createClaimantDashboardReadModelCoordinatorV1(input: CoordinatorInput) {
  let active = false;
  let current: ClaimantDashboardReadModelV1 | null = null;
  let epoch = 0;
  const assertApproved = () => {
    if (!(input.approved ?? CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED)) {
      throw new ClaimantDashboardCoordinatorError("disabled");
    }
  };
  return {
    clear() { epoch += 1; current = null; notify(input, null); },
    getSnapshot() { return current; },
    async refresh(caseId: string, signal?: AbortSignal) {
      assertApproved();
      if (active) throw new ClaimantDashboardCoordinatorError("busy");
      if (!uuid.test(caseId)) throw new ClaimantDashboardCoordinatorError("invalid_input");
      activeSignal(signal); active = true;
      const previous = current?.case_id === caseId ? current : null;
      if (current && !previous) { current = null; notify(input, null); }
      const requestEpoch = epoch;
      try {
        const response = await input.transport.read({ caseId,
          knownProjectionVersion: previous?.projection_version ?? null, signal });
        activeSignal(signal);
        if (requestEpoch !== epoch) throw new ClaimantDashboardCoordinatorError("aborted");
        validateReadModel(response, caseId, input.now?.() ?? new Date());
        if (previous && response.projection_version < previous.projection_version) {
          throw new ClaimantDashboardCoordinatorError("stale_response");
        }
        if (previous && response.projection_version === previous.projection_version
          && canonicalJson(response) !== canonicalJson(previous)) {
          throw new ClaimantDashboardCoordinatorError("divergent_response");
        }
        current = freezeReadModel(response); notify(input, current); return current;
      } catch (error) {
        throw safeError(error, signal);
      } finally { active = false; }
    },
  };
}

function validateReadModel(value: ClaimantDashboardReadModelV1, caseId: string, now: Date) {
  if (!isRecord(value) || !exactKeys(value, ["case_id", "case_version", "decision_readiness",
    "journey", "last_meaningful_update_date", "projection_version", "protocol",
    "review_tracking", "support_route", "synthetic_only"])
    || value.protocol !== "sanduqkin:claim:dashboard-read-model:v1"
    || value.case_id !== caseId || !positive(value.case_version)
    || value.projection_version !== value.case_version || value.synthetic_only !== true
    || value.support_route !== "secure_case_support"
    || !safeDate(value.last_meaningful_update_date, now)
    || !canonicalProjectionTriplets.has(canonicalJson({ decision_readiness: value.decision_readiness,
      journey: value.journey, review_tracking: value.review_tracking }))) {
    throw new ClaimantDashboardCoordinatorError("invalid_response");
  }
}

function freezeReadModel(value: ClaimantDashboardReadModelV1) {
  return deepFreeze(structuredClone(value)) as ClaimantDashboardReadModelV1;
}
function deepFreeze(value: unknown): unknown {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function safeDate(value: unknown, now: Date) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value)
    && value <= now.toISOString().slice(0, 10);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function positive(value: number) { return Number.isSafeInteger(value) && value > 0; }
function notify(input: CoordinatorInput, value: ClaimantDashboardReadModelV1 | null) {
  try { input.onChange?.(value); } catch { /* Observer failures cannot alter trusted state. */ }
}
function activeSignal(signal?: AbortSignal) {
  if (signal?.aborted) throw new ClaimantDashboardCoordinatorError("aborted");
}
function safeError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return new ClaimantDashboardCoordinatorError("aborted");
  if (error instanceof ClaimantDashboardCoordinatorError) return error;
  return new ClaimantDashboardCoordinatorError("failed");
}

const canonicalProjectionTriplets = new Set(claimantStates.map((state) => canonicalJson({
  decision_readiness: projectClaimantPublicDecisionReadiness(state),
  journey: projectClaimantPublicJourney(state),
  review_tracking: projectClaimantPublicReviewTracking(state),
})));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
