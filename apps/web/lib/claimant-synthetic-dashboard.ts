import {
  projectClaimantPublicJourney,
  type ClaimantPublicJourneyProjectionV1,
  type ClaimantState,
} from "@vault/shared-types";

export type ClaimantSyntheticDashboardFixture = {
  key: "completed" | "on-hold" | "rejected" | "owner-cancelled";
  label: string;
  description: string;
  synthetic_only: true;
  projection: ClaimantPublicJourneyProjectionV1;
};

const fixtureDefinitions = [
  {
    key: "completed",
    label: "Completed journey",
    description:
      "Demonstrates explicit retrieval confirmation followed by policy-controlled case closure.",
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
    key: "owner-cancelled",
    label: "Owner cancellation recorded",
    description:
      "Demonstrates a protected cancellation outcome without revealing owner-response details.",
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
