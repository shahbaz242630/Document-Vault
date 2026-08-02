import type {
  ClaimantPublicDecisionStatus,
  ClaimantPublicRetrievalStatus,
} from "@vault/shared-types";

export function DecisionReadinessStatus({
  decisionStatus,
  retrievalStatus,
}: {
  decisionStatus: ClaimantPublicDecisionStatus;
  retrievalStatus: ClaimantPublicRetrievalStatus;
}) {
  return (
    <dl className="decision-readiness-controls">
      <div><dt>Decision status</dt><dd>{formatDecisionStatus(decisionStatus)}</dd></div>
      <div><dt>Secure retrieval</dt><dd>{formatRetrievalStatus(retrievalStatus)}</dd></div>
    </dl>
  );
}

function formatDecisionStatus(status: ClaimantPublicDecisionStatus): string {
  if (status === "pending") return "Pending";
  if (status === "recorded") return "Recorded";
  return "Not displayed";
}

function formatRetrievalStatus(status: ClaimantPublicRetrievalStatus): string {
  if (status === "not_ready") return "Not ready";
  if (status === "preparing") return "Preparing";
  if (status === "available") return "Available in approved native client";
  if (status === "blocked") return "Not available";
  if (status === "expired") return "Expired";
  if (status === "suspended") return "Suspended";
  if (status === "closed") return "Closed";
  return "Not displayed";
}
