import { describe, expect, it } from "vitest";

import { createServerEphemeralKeyCustodyV1 } from "./server-ephemeral-key-custody.js";

const claimant = "21000000-0000-4000-8000-000000000002";
const challenge = "71000000-0000-4000-8000-000000000001";

describe("server ephemeral-key custody", () => {
  it("round-trips a scalar only under its exact claimant/challenge context", () => {
    const custody = createServerEphemeralKeyCustodyV1(Buffer.alloc(32, 7));
    const privateKey = Buffer.alloc(32); privateKey[31] = 5;
    const envelope = custody.seal({ claimantUserId: claimant, nativeChallengeId: challenge, privateKey });
    expect(custody.open({ claimantUserId: claimant, nativeChallengeId: challenge, envelope })).toEqual(privateKey);
    expect(envelope).not.toContain(privateKey.toString("base64url"));
  });

  it("rejects tampering and cross-claimant or cross-challenge opening", () => {
    const custody = createServerEphemeralKeyCustodyV1(Buffer.alloc(32, 7));
    const envelope = custody.seal({ claimantUserId: claimant, nativeChallengeId: challenge, privateKey: Buffer.alloc(32, 9) });
    const parts = envelope.split(".");
    parts[2] = `${parts[2]![0] === "A" ? "B" : "A"}${parts[2]!.slice(1)}`;
    const tamperedEnvelope = parts.join(".");
    for (const changed of [
      { claimantUserId: "21000000-0000-4000-8000-000000000003", nativeChallengeId: challenge, envelope },
      { claimantUserId: claimant, nativeChallengeId: "71000000-0000-4000-8000-000000000002", envelope },
      { claimantUserId: claimant, nativeChallengeId: challenge, envelope: tamperedEnvelope },
    ]) expect(() => custody.open(changed)).toThrow("custody failed");
  });
});
