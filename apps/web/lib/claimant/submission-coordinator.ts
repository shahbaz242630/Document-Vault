import {
  claimantChecklistItemKeys,
  syntheticReviewSubmissionDeclarationKeys,
  type SyntheticReviewSubmissionEnvelopeV1,
} from "@vault/shared-types";

export const CLAIMANT_SUBMISSION_COORDINATOR_APPROVED = false as const;

export type ClaimSubmissionRequestV1 = Readonly<{
  caseId: string;
  envelope: SyntheticReviewSubmissionEnvelopeV1;
  expectedIntakeVersion: number;
  expectedPreparationVersion: number;
}>;

export type ClaimSubmissionSafeAcknowledgementV1 = Readonly<{
  acknowledgement_ref: string;
  case_id: string;
  case_version: number;
  intake_version: number;
  preparation_version: number;
  release_authorized: false;
  replayed: boolean;
  review_started: false;
  state: "submitted";
  status: "already_received" | "received_for_review";
}>;

export type ClaimSubmissionTransportV1 = Readonly<{
  submit(input: Readonly<{
    body: Readonly<{
      envelope: SyntheticReviewSubmissionEnvelopeV1;
      expected_intake_version: number;
      expected_preparation_version: number;
    }>;
    caseId: string;
    idempotencyKey: string;
    signal?: AbortSignal;
  }>): Promise<unknown>;
}>;

export class ClaimSubmissionCoordinatorError extends Error {
  constructor(readonly kind: "aborted" | "busy" | "disabled" | "failed" |
    "invalid_input" | "invalid_response" | "retry_required") {
    super("Claim submission could not be completed.");
    this.name = "ClaimSubmissionCoordinatorError";
  }
}

export class ClaimSubmissionTransportError extends Error {
  constructor(readonly kind: "aborted" | "authentication" | "conflict" |
    "invalid_request" | "rate_limited" | "unavailable") {
    super("Claim submission request could not be completed.");
    this.name = "ClaimSubmissionTransportError";
  }
}

type PendingAttempt = Readonly<{
  request: Readonly<{
    body: Readonly<{
      envelope: SyntheticReviewSubmissionEnvelopeV1;
      expected_intake_version: number;
      expected_preparation_version: number;
    }>;
    caseId: string;
    idempotencyKey: string;
  }>;
  expectedCaseVersion: number;
}>;

type CoordinatorInput = Readonly<{
  approved?: boolean;
  createIdempotencyKey: () => string;
  transport: ClaimSubmissionTransportV1;
}>;

export function createClaimSubmissionCoordinatorV1(input: CoordinatorInput) {
  let active = false;
  let pending: PendingAttempt | null = null;
  const assertApproved = () => {
    if (!(input.approved ?? CLAIMANT_SUBMISSION_COORDINATOR_APPROVED)) {
      throw new ClaimSubmissionCoordinatorError("disabled");
    }
  };
  return {
    hasPendingRetry: () => pending !== null,
    async retry(signal?: AbortSignal) {
      assertApproved();
      if (active) throw new ClaimSubmissionCoordinatorError("busy");
      if (!pending) return { status: "none" as const };
      active = true;
      try {
        const acknowledgement = await dispatch(input.transport, pending, signal);
        pending = null;
        return { acknowledgement, status: "completed" as const };
      } catch (error) {
        if (!ambiguous(error, signal)) pending = null;
        throw safeError(error, signal);
      } finally { active = false; }
    },
    async submit(value: ClaimSubmissionRequestV1, signal?: AbortSignal) {
      assertApproved();
      if (active) throw new ClaimSubmissionCoordinatorError("busy");
      if (pending) throw new ClaimSubmissionCoordinatorError("retry_required");
      validateRequest(value);
      activeSignal(signal);
      const idempotencyKey = requireUuid(input.createIdempotencyKey());
      const envelope = deepFreeze(structuredClone({ ...value.envelope,
        idempotency_key: idempotencyKey })) as SyntheticReviewSubmissionEnvelopeV1;
      pending = { expectedCaseVersion: envelope.expected_case_version,
        request: deepFreeze({ body: { envelope,
          expected_intake_version: value.expectedIntakeVersion,
          expected_preparation_version: value.expectedPreparationVersion },
        caseId: value.caseId, idempotencyKey }) };
      active = true;
      try {
        const acknowledgement = await dispatch(input.transport, pending, signal);
        pending = null;
        return acknowledgement;
      } catch (error) {
        if (!ambiguous(error, signal)) pending = null;
        throw safeError(error, signal);
      } finally { active = false; }
    },
  };
}

async function dispatch(transport: ClaimSubmissionTransportV1, attempt: PendingAttempt,
  signal?: AbortSignal) {
  activeSignal(signal);
  const response = await transport.submit({ ...attempt.request, signal });
  activeSignal(signal);
  return validateAcknowledgement(response, attempt);
}

function validateRequest(value: ClaimSubmissionRequestV1) {
  if (!isRecord(value) || !exactKeys(value, ["caseId", "envelope", "expectedIntakeVersion",
    "expectedPreparationVersion"]) || !uuid.test(value.caseId)
    || !positive(value.expectedIntakeVersion) || value.expectedIntakeVersion < 2
    || !positive(value.expectedPreparationVersion) || value.expectedPreparationVersion < 2
    || !validEnvelope(value.envelope, value.caseId)) invalidInput();
}

function validEnvelope(value: unknown, caseId: string): value is SyntheticReviewSubmissionEnvelopeV1 {
  if (!isRecord(value) || !exactKeys(value, ["case_ref", "created_at", "declarations",
    "evidence_bundle_ref", "evidence_manifest", "expected_case_version", "idempotency_key",
    "policy_id", "policy_version", "production_approved", "protocol", "release_authorized",
    "runtime_submission_authorized", "status", "submission_ref", "synthetic_only"])) return false;
  if (value.protocol !== "sanduqkin:claim:review-submission-envelope:v1"
    || value.synthetic_only !== true || value.production_approved !== false
    || value.runtime_submission_authorized !== false || value.release_authorized !== false
    || value.status !== "assembled_for_review_submission" || value.case_ref !== caseId
    || !uuid.test(String(value.idempotency_key)) || !positive(value.expected_case_version as number)
    || !positive(value.policy_version as number)
    || !/^synthetic_submission_[a-z0-9_]{1,100}$/u.test(String(value.submission_ref))
    || !/^synthetic_policy_[a-z0-9_]{1,100}$/u.test(String(value.policy_id))
    || !/^synthetic_bundle_[a-z0-9_]{1,100}$/u.test(String(value.evidence_bundle_ref))
    || !exactTimestamp(value.created_at)) return false;
  if (!Array.isArray(value.declarations)) return false;
  const declarations = value.declarations;
  if (declarations.length !== syntheticReviewSubmissionDeclarationKeys.length
    || new Set(declarations).size !== declarations.length
    || syntheticReviewSubmissionDeclarationKeys.some((key) => !declarations.includes(key))) return false;
  if (!Array.isArray(value.evidence_manifest) || value.evidence_manifest.length > 13) return false;
  const itemKeys = new Set<string>(); const refs = new Set<string>();
  for (const item of value.evidence_manifest) {
    if (!isRecord(item) || !exactKeys(item, ["item_key", "placeholder_ref"])
      || !claimantChecklistItemKeys.includes(item.item_key as never)
      || !/^synthetic_evidence_[a-z0-9_]{1,100}$/u.test(String(item.placeholder_ref))
      || itemKeys.has(String(item.item_key)) || refs.has(String(item.placeholder_ref))) return false;
    itemKeys.add(String(item.item_key)); refs.add(String(item.placeholder_ref));
  }
  return true;
}

function validateAcknowledgement(value: unknown, attempt: PendingAttempt) {
  if (!isRecord(value) || !exactKeys(value, ["result"]) || !isRecord(value.result)) invalidResponse();
  const result = value.result;
  if (!exactKeys(result, ["acknowledgement_ref", "case_id", "case_version", "intake_version",
    "preparation_version", "release_authorized", "replayed", "review_started", "state", "status"])
    || !/^synthetic_acknowledgement_[a-z0-9]{32}$/u.test(String(result.acknowledgement_ref))
    || result.case_id !== attempt.request.caseId
    || result.case_version !== attempt.expectedCaseVersion + 1
    || result.intake_version !== attempt.request.body.expected_intake_version
    || result.preparation_version !== attempt.request.body.expected_preparation_version
    || result.release_authorized !== false || typeof result.replayed !== "boolean"
    || result.review_started !== false || result.state !== "submitted"
    || !["already_received", "received_for_review"].includes(String(result.status))
    || (result.replayed === true) !== (result.status === "already_received")) invalidResponse();
  return deepFreeze(structuredClone(result)) as ClaimSubmissionSafeAcknowledgementV1;
}

function ambiguous(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return true;
  if (error instanceof ClaimSubmissionCoordinatorError) return error.kind === "invalid_response";
  if (error instanceof ClaimSubmissionTransportError) {
    return ["aborted", "conflict", "rate_limited", "unavailable"].includes(error.kind);
  }
  return true;
}
function safeError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted || error instanceof ClaimSubmissionTransportError && error.kind === "aborted") {
    return new ClaimSubmissionCoordinatorError("aborted");
  }
  if (error instanceof ClaimSubmissionCoordinatorError && error.kind === "invalid_response") return error;
  return new ClaimSubmissionCoordinatorError(ambiguous(error, signal) ? "retry_required" : "failed");
}
function activeSignal(signal?: AbortSignal) {
  if (signal?.aborted) throw new ClaimSubmissionCoordinatorError("aborted");
}
function exactTimestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp = Date.parse(value); return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function requireUuid(value: string) { if (!uuid.test(value)) invalidInput(); return value; }
function positive(value: number) { return Number.isSafeInteger(value) && value > 0; }
function invalidInput(): never { throw new ClaimSubmissionCoordinatorError("invalid_input"); }
function invalidResponse(): never { throw new ClaimSubmissionCoordinatorError("invalid_response"); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
