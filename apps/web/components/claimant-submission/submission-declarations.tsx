import type { SyntheticReviewSubmissionDeclarationKey } from "@vault/shared-types";

const declarationLabels: Record<SyntheticReviewSubmissionDeclarationKey, string> = {
  information_is_accurate: "The supplied synthetic information is accurate.",
  evidence_is_lawfully_held: "The synthetic evidence is lawfully held.",
  known_conflicts_are_disclosed: "Known conflicts are disclosed for review.",
  review_is_not_release: "Review readiness is not release authorization.",
};

export function SubmissionDeclarations({ declarations }: { declarations: readonly SyntheticReviewSubmissionDeclarationKey[] }) {
  return (
    <section className="submission-detail" aria-label="Bound declarations">
      <h3>Bound declarations</h3>
      <ul className="submission-declarations">
        {declarations.map((declaration) => <li key={declaration}>{declarationLabels[declaration]}</li>)}
      </ul>
    </section>
  );
}
