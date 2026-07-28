import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertClaimTransitionRequestV1,
  assertRecipientGrantEnvelopeV2,
  assertRecipientPossessionChallengeV2,
  evaluateClaimTransition,
  type ClaimTransitionRequestV1,
} from "@vault/shared-types";
import { describe, expect, it } from "vitest";

describe("API claimant protocol vector consumer", () => {
  it("consumes the complete state matrix without exposing an API route", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "../../packages/shared-types/test-vectors/claim/claim-state-v1.json",
        ),
        "utf8",
      ),
    ) as {
      transition_matrix: (
        Omit<ClaimTransitionRequestV1, "protocol"> & {
          expected_allowed: boolean;
        }
      )[];
    };

    for (const entry of fixture.transition_matrix) {
      const { expected_allowed, ...request } = entry;
      const fullRequest = {
        protocol: "sanduqkin:claim:state:v1",
        ...request,
      } satisfies ClaimTransitionRequestV1;
      assertClaimTransitionRequestV1(fullRequest);
      expect(evaluateClaimTransition(fullRequest).allowed).toBe(
        expected_allowed,
      );
    }
  });

  it("consumes registered-recipient V2 bindings without exposing a route", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "../../packages/shared-types/test-vectors/claim/recipient-grant-v2.json",
        ),
        "utf8",
      ),
    ) as {
      possession: { challenge: unknown };
      grant: { envelope: unknown };
    };
    assertRecipientPossessionChallengeV2(fixture.possession.challenge);
    assertRecipientGrantEnvelopeV2(fixture.grant.envelope);
  });
});
