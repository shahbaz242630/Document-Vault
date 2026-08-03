import type { ClaimantPublicControlStatus } from "@vault/shared-types";

export function ReviewControlStatus({
  label,
  status,
}: {
  label: string;
  status: ClaimantPublicControlStatus;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatStatus(status)}</dd>
    </div>
  );
}

function formatStatus(status: ClaimantPublicControlStatus): string {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "complete") return "Recorded";
  return "Not displayed";
}
