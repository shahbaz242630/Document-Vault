import type { SyntheticRenderedChecklistV1 } from "@vault/shared-types";

export function PolicyBoundary({ checklist }: { checklist: SyntheticRenderedChecklistV1 }) {
  return (
    <article className="checklist-policy-boundary">
      <p className="eyebrow">Policy boundary</p>
      <h3>{checklist.policy_id ? "Synthetic policy selected" : "No policy selected"}</h3>
      <p>
        {checklist.policy_id
          ? `Fixture ${checklist.policy_id}, version ${checklist.policy_version}.`
          : "The checklist fails closed and exposes no requirements without an applicable policy."}
      </p>
      <p><strong>Release authorized:</strong> No</p>
    </article>
  );
}
