import { syntheticReviewSubmissionDeclarationKeys } from "./declarations";
import type {
  SyntheticReviewSubmissionAssemblyInputV1,
  SyntheticReviewSubmissionIssueCode,
} from "./contracts";
import { addSyntheticSubmissionIssue } from "./issues";

export function validateSyntheticSubmissionDraft(
  input: SyntheticReviewSubmissionAssemblyInputV1,
): SyntheticReviewSubmissionIssueCode[] {
  const issues: SyntheticReviewSubmissionIssueCode[] = [];
  const { draft } = input;

  if (
    draft.protocol !== "sanduqkin:claim:review-submission-draft:v1" ||
    draft.synthetic_only !== true ||
    draft.production_approved !== false ||
    !/^synthetic_submission_[a-z0-9_]+$/u.test(draft.submission_ref) ||
    !/^synthetic_idempotency_[a-z0-9_]+$/u.test(draft.idempotency_key) ||
    !/^synthetic_case_[a-z0-9_]+$/u.test(draft.case_ref) ||
    !Number.isSafeInteger(draft.expected_case_version) ||
    draft.expected_case_version < 0
  ) {
    addSyntheticSubmissionIssue(issues, "invalid_draft");
  }
  validateCreatedAt(draft.created_at, input.server_time, issues);
  validateDeclarations(draft.declarations, issues);

  if (draft.expected_case_version !== input.current_case_version) {
    addSyntheticSubmissionIssue(issues, "stale_case_version");
  }
  if (input.used_submission_refs.includes(draft.submission_ref)) {
    addSyntheticSubmissionIssue(issues, "replayed_submission_ref");
  }
  if (input.used_idempotency_keys.includes(draft.idempotency_key)) {
    addSyntheticSubmissionIssue(issues, "replayed_idempotency_key");
  }
  return issues;
}

function validateCreatedAt(
  createdAt: string,
  serverTime: string,
  issues: SyntheticReviewSubmissionIssueCode[],
) {
  const created = Date.parse(createdAt);
  const server = Date.parse(serverTime);
  if (!Number.isFinite(created) || new Date(created).toISOString() !== createdAt) {
    addSyntheticSubmissionIssue(issues, "invalid_created_at");
  } else if (!Number.isFinite(server) || created > server) {
    addSyntheticSubmissionIssue(issues, "created_in_future");
  }
}

function validateDeclarations(
  declarations: Record<string, unknown>,
  issues: SyntheticReviewSubmissionIssueCode[],
) {
  const keys = Object.keys(declarations);
  const allowedKeys = new Set<string>(syntheticReviewSubmissionDeclarationKeys);
  if (
    keys.length !== syntheticReviewSubmissionDeclarationKeys.length ||
    syntheticReviewSubmissionDeclarationKeys.some((key) => declarations[key] !== true) ||
    keys.some((key) => !allowedKeys.has(key))
  ) {
    addSyntheticSubmissionIssue(issues, "incomplete_declarations");
  }
}
