import type { ClaimantState } from "../contracts";
import type { ClaimantPublicDecisionReadinessProjectionV1 } from "./contracts";
import { projectClaimantPublicDecisionReadiness } from "./projection";

export type SyntheticClaimantDecisionReadinessFixtureV1 = {
  key:
    | "pending"
    | "preparing"
    | "available-before-delivery"
    | "available-after-delivery"
    | "blocked-one"
    | "blocked-two"
    | "expired"
    | "suspended"
    | "closed"
    | "invalid-input";
  synthetic_only: true;
  projection: ClaimantPublicDecisionReadinessProjectionV1;
};

const fixtureStates = [
  ["pending", "review_pending"],
  ["preparing", "approved"],
  ["available-before-delivery", "release_ready"],
  ["available-after-delivery", "released"],
  ["blocked-one", "cancelled_by_owner"],
  ["blocked-two", "rejected"],
  ["expired", "expired"],
  ["suspended", "release_suspended"],
  ["closed", "closed"],
] as const satisfies readonly (readonly [
  SyntheticClaimantDecisionReadinessFixtureV1["key"],
  ClaimantState,
])[];

export const syntheticClaimantDecisionReadinessFixtures = [
  ...fixtureStates.map(([key, state]) => ({
    key,
    synthetic_only: true as const,
    projection: projectClaimantPublicDecisionReadiness(state),
  })),
  {
    key: "invalid-input",
    synthetic_only: true as const,
    projection: projectClaimantPublicDecisionReadiness("not-a-claimant-state"),
  },
] as const satisfies readonly SyntheticClaimantDecisionReadinessFixtureV1[];
