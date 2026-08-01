import type { SyntheticReviewSubmissionIssueCode } from "./contracts";

export function addSyntheticSubmissionIssue(
  issues: SyntheticReviewSubmissionIssueCode[],
  issue: SyntheticReviewSubmissionIssueCode,
) {
  if (!issues.includes(issue)) issues.push(issue);
}
