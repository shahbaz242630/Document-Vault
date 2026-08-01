import { describe, expect, it } from "vitest";

import type { SyntheticChecklistPolicyPackV1 } from "./contracts";
import {
  createSyntheticChecklistRoutingFacts,
  syntheticChecklistPolicyPack,
} from "./fixtures";
import { selectSyntheticChecklistPolicy } from "./policy-selection";

const validTime = "2026-08-01T10:00:00.000Z";

describe("synthetic checklist policy selection", () => {
  it("selects exactly one matching, current, intact synthetic policy", () => {
    expect(
      selectSyntheticChecklistPolicy({
        packs: [syntheticChecklistPolicyPack],
        facts: createSyntheticChecklistRoutingFacts(),
        server_time: validTime,
      }),
    ).toEqual({ status: "selected", pack: syntheticChecklistPolicyPack });
  });

  it("fails closed for a missing or conflicting policy", () => {
    expect(
      selectSyntheticChecklistPolicy({
        packs: [],
        facts: createSyntheticChecklistRoutingFacts(),
        server_time: validTime,
      }),
    ).toEqual({ status: "manual_review", reason: "missing_policy" });

    expect(
      selectSyntheticChecklistPolicy({
        packs: [syntheticChecklistPolicyPack, syntheticChecklistPolicyPack],
        facts: createSyntheticChecklistRoutingFacts(),
        server_time: validTime,
      }),
    ).toEqual({ status: "manual_review", reason: "conflicting_policy" });
  });

  it("fails closed for expired, tampered, or unsigned policy fixtures", () => {
    expect(
      selectSyntheticChecklistPolicy({
        packs: [syntheticChecklistPolicyPack],
        facts: createSyntheticChecklistRoutingFacts(),
        server_time: "2027-01-01T00:00:00.000Z",
      }),
    ).toEqual({ status: "manual_review", reason: "expired_policy" });

    expect(
      selectSyntheticChecklistPolicy({
        packs: [
          {
            ...syntheticChecklistPolicyPack,
            accountable_approver_ref: "synthetic_approver_tampered",
          },
        ],
        facts: createSyntheticChecklistRoutingFacts(),
        server_time: validTime,
      }),
    ).toEqual({ status: "manual_review", reason: "invalid_policy" });

    expect(
      selectSyntheticChecklistPolicy({
        packs: [
          {
            ...syntheticChecklistPolicyPack,
            integrity: undefined,
          } as unknown as SyntheticChecklistPolicyPackV1,
        ],
        facts: createSyntheticChecklistRoutingFacts(),
        server_time: validTime,
      }),
    ).toEqual({ status: "manual_review", reason: "invalid_policy" });
  });

  it("does not use a default policy for an unsupported jurisdiction", () => {
    expect(
      selectSyntheticChecklistPolicy({
        packs: [syntheticChecklistPolicyPack],
        facts: {
          ...createSyntheticChecklistRoutingFacts(),
          jurisdiction_key: "synthetic_jurisdiction_unsupported",
        },
        server_time: validTime,
      }),
    ).toEqual({ status: "manual_review", reason: "missing_policy" });
  });
});
