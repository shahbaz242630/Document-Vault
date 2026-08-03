import {
  projectClaimantPublicJourney,
  type ClaimantPublicJourneyProjectionV1,
  type ClaimantState,
} from "@vault/shared-types";

export type ClaimantSyntheticDashboardFixture = {
  key: "completed" | "on-hold" | "rejected" | "case-ended";
  label: string;
  description: string;
  synthetic_only: true;
  projection: ClaimantPublicJourneyProjectionV1;
};

const fixtureDefinitions = [
  {
    key: "completed",
    label: "Closed journey",
    description:
      "Demonstrates policy-controlled case closure without claiming that information was opened, read, exported, or retained.",
    state: "closed",
  },
  {
    key: "on-hold",
    label: "Case safely on hold",
    description:
      "Demonstrates a paused case without exposing private hold reasons or internal control details.",
    state: "on_hold",
  },
  {
    key: "rejected",
    label: "Decision recorded",
    description:
      "Demonstrates a rejected case without creating a retrieval path or exposing private review details.",
    state: "rejected",
  },
  {
    key: "case-ended",
    label: "Case outcome recorded",
    description:
      "Demonstrates a stopped outcome without revealing its private cause or any owner-response detail.",
    state: "cancelled_by_owner",
  },
] as const satisfies readonly {
  key: ClaimantSyntheticDashboardFixture["key"];
  label: string;
  description: string;
  state: ClaimantState;
}[];

export const claimantSyntheticDashboardFixtures: readonly ClaimantSyntheticDashboardFixture[] =
  fixtureDefinitions.map(({ state, ...definition }) => ({
    ...definition,
    synthetic_only: true,
    projection: projectClaimantPublicJourney(state),
  }));
