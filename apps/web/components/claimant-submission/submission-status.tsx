import type { SyntheticReviewSubmissionAssemblyResultV1 } from "@vault/shared-types";

export function SubmissionStatus({ result }: { result: SyntheticReviewSubmissionAssemblyResultV1 }) {
  const assembled = result.status === "assembled";

  return (
    <article className={`submission-status submission-status-${result.status}`}>
      <p className="eyebrow">Assembly status</p>
      <h3>{assembled ? "Assembled for review submission" : "Assembly rejected safely"}</h3>
      <p>
        {assembled
          ? "The synthetic envelope is complete but remains local and unsubmitted."
          : "No envelope was produced and no runtime action occurred."}
      </p>
    </article>
  );
}
