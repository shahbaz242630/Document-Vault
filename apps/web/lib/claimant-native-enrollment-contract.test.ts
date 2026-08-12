import { describe, expect, it } from "vitest";

import {
  assertNativeEnrollmentFixtureV1,
  nativeEnrollmentSyntheticFixtureV1,
} from "@vault/shared-types";

describe("web native enrollment contract consumer", () => {
  it("reads public continuation metadata without a key or runtime action", () => {
    const fixture = assertNativeEnrollmentFixtureV1(nativeEnrollmentSyntheticFixtureV1);
    expect(fixture.challenge_request.capability.public_key_encoding).toBe("ansi_x9_63_uncompressed");
    expect(Object.keys(fixture.challenge_request)).not.toContain("user_id");
    expect(Object.keys(fixture.challenge_request)).not.toContain("recipient_address_digest");
  });

  it("rejects a client-added address authority field", () => {
    const fixture = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as {
      challenge_request: Record<string, unknown>;
    };
    fixture.challenge_request.email = "synthetic@example.test";
    expect(() => assertNativeEnrollmentFixtureV1(fixture)).toThrow("missing or prohibited fields");
  });
});
