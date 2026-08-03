import {
  applySyntheticSubmissionHandoff,
  createSyntheticSubmissionHandoffInput,
  type SyntheticSubmissionAcknowledgementV1,
} from "@vault/shared-types";

export type ClaimantSyntheticAcknowledgementFixture = {
  key: "received" | "already-received";
  eyebrow: string;
  title: string;
  summary: string;
  nextAction: string;
  claimantActionRequired: boolean;
  receiptConfirmed: true;
  reviewStarted: false;
  releaseAuthorized: false;
};

const handoffInput = createSyntheticSubmissionHandoffInput();
const applied = applySyntheticSubmissionHandoff(handoffInput);

if (applied.status !== "applied") {
  throw new Error("Synthetic acknowledgement fixture did not apply.");
}

const duplicate = applySyntheticSubmissionHandoff({
  ...handoffInput,
  snapshot: applied.snapshot,
});

if (duplicate.status !== "duplicate") {
  throw new Error("Synthetic duplicate acknowledgement fixture did not resolve.");
}

export const claimantSyntheticAcknowledgementFixtures = [
  projectPublicAcknowledgement(applied.acknowledgement, "received"),
  projectPublicAcknowledgement(duplicate.acknowledgement, "already-received"),
] as const satisfies readonly ClaimantSyntheticAcknowledgementFixture[];

function projectPublicAcknowledgement(
  acknowledgement: SyntheticSubmissionAcknowledgementV1,
  key: ClaimantSyntheticAcknowledgementFixture["key"],
): ClaimantSyntheticAcknowledgementFixture {
  return {
    key,
    eyebrow: key === "received" ? "Receipt confirmed" : "Previous receipt confirmed",
    title:
      key === "received"
        ? "Your information was received safely"
        : "Your information was already received",
    summary:
      key === "received"
        ? "There is nothing else to send right now. Keep your account secure while the next protected step is prepared."
        : "You do not need to send the same information again. The protected journey remains at the same stage.",
    nextAction: acknowledgement.projection.next_action,
    claimantActionRequired: acknowledgement.projection.claimant_action_required,
    receiptConfirmed: true,
    reviewStarted: false,
    releaseAuthorized: false,
  };
}
