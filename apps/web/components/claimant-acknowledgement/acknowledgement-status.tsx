import type { ClaimantSyntheticAcknowledgementFixture } from "@/lib/claimant-synthetic-acknowledgement";

export function AcknowledgementStatus({
  fixture,
}: {
  fixture: ClaimantSyntheticAcknowledgementFixture;
}) {
  return (
    <article className="acknowledgement-status">
      <p className="eyebrow">Safe claimant message</p>
      <h3>{fixture.title}</h3>
      <p>{fixture.summary}</p>
    </article>
  );
}
