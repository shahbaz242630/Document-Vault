import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertOfflineCodeChallengeV2,
  assertRecipientGrantEnvelopeV2,
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

describe("web claimant protocol vector consumer", () => {
  it("consumes the V2 challenge and release manifest without runtime wiring", () => {
    const offline = fixture("offline-code-v2.json");
    assertOfflineCodeChallengeV2(offline.challenge);
    expect(canonicalJson(offline.challenge)).toBeTruthy();
    expect(
      (offline.kdf_profile as { production_approved: boolean })
        .production_approved,
    ).toBe(false);

    const release = fixture("release-package-v1.json");
    const releaseCase = release.offline_code as { manifest: unknown };
    assertReleaseManifestV1(releaseCase.manifest);
    expect(releaseCase.manifest.release_material.profile).toBe(
      "offline_code_v2",
    );
  });

  it("consumes the registered-recipient V2 public bindings offline", () => {
    const vector = fixture("recipient-grant-v2.json");
    const possession = vector.possession as { challenge: unknown };
    const grant = vector.grant as { envelope: unknown };
    assertRecipientPossessionChallengeV2(possession.challenge);
    assertRecipientGrantEnvelopeV2(grant.envelope);
    expect(canonicalJson(possession.challenge)).toBeTruthy();
  });
});
