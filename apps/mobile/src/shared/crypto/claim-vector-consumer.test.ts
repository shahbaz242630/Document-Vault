import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertRecipientGrantPlaintextV1,
  assertRecipientGrantEnvelopeV2,
  assertRecipientGrantPlaintextV2,
  assertRecipientPossessionChallengeV2,
  assertReleaseManifestV1,
  canonicalJson,
} from "@vault/shared-types";
import { describe, expect, it } from "vitest";

function fixture(filename: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        "../../packages/shared-types/test-vectors/claim",
        filename,
      ),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

describe("mobile claimant protocol vector consumer", () => {
  it("consumes the shared grant and closed release profiles offline", () => {
    const grant = fixture("recipient-grant-v1.json");
    assertRecipientGrantPlaintextV1(grant.plaintext);
    expect(canonicalJson(grant.plaintext)).toBeTruthy();

    const release = fixture("release-package-v1.json");
    const registered = release.registered_recipient as {
      manifest: unknown;
    };
    const offline = release.offline_code as { manifest: unknown };
    assertReleaseManifestV1(registered.manifest);
    assertReleaseManifestV1(offline.manifest);
    expect(registered.manifest.release_material.profile).toBe(
      "registered_recipient_v1",
    );
    expect(offline.manifest.release_material.profile).toBe("offline_code_v2");
  });

  it("consumes the registered-recipient V2 reference profile offline", () => {
    const vector = fixture("recipient-grant-v2.json");
    const possession = vector.possession as { challenge: unknown };
    const grant = vector.grant as {
      plaintext: unknown;
      envelope: unknown;
      associated_data: unknown;
    };
    assertRecipientPossessionChallengeV2(possession.challenge);
    assertRecipientGrantPlaintextV2(grant.plaintext);
    assertRecipientGrantEnvelopeV2(grant.envelope);
    expect(canonicalJson(possession.challenge)).toBeTruthy();
    expect(canonicalJson(grant.associated_data as never)).toBeTruthy();
  });
});
