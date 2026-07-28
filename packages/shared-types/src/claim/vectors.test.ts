import { readFileSync } from "node:fs";
import { createECDH, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

import sodium from "libsodium-wrappers-sumo";
import { beforeAll, describe, expect, it } from "vitest";

import {
  canonicalJson,
  type CanonicalJsonValue,
} from "./canonical-json";
import type {
  ClaimTransitionRequestV1,
  OfflineCodeChallengeV2,
  RecipientGrantEnvelopeV2,
  RecipientGrantPlaintextV2,
  RecipientPossessionChallengeV2,
  ReleaseManifestV1,
} from "./contracts";
import { evaluateClaimTransition } from "./state-machine";
import {
  assertClaimTransitionRequestV1,
  assertOfflineCodeChallengeV2,
  assertOfflineCodeKdfProfileV2,
  assertRecipientGrantEnvelopeV1,
  assertRecipientGrantPlaintextV1,
  assertReleaseManifestV1,
} from "./validation";
import {
  assertRecipientGrantEnvelopeV2,
  assertRecipientGrantPlaintextV2,
  assertRecipientPossessionChallengeV2,
} from "./recipient-v2-validation";

const vectorDirectory = fileURLToPath(
  new URL("../../test-vectors/claim/", import.meta.url),
);

function vector<T>(filename: string): T {
  return JSON.parse(
    readFileSync(`${vectorDirectory}${filename}`, "utf8"),
  ) as T;
}

function fromBase64url(value: string): Uint8Array {
  return sodium.from_base64(
    value,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
}

type RecipientVector = {
  meta: { synthetic_only: boolean; production_data: boolean };
  key_material: {
    recipient_public_key: string;
    recipient_private_key: string;
  };
  plaintext: unknown;
  canonical_plaintext: string;
  captured_sealed_box_ciphertext: string;
  envelope: unknown;
};

type OfflineVector = {
  meta: { synthetic_only: boolean };
  kdf_profile: {
    production_approved: boolean;
    opslimit: number;
    memlimit_bytes: number;
    salt: string;
  };
  human_material: { normalized_secret: string };
  derived: {
    root: string;
    proof_public_key: string;
    wrap_key: string;
  };
  challenge: OfflineCodeChallengeV2;
  challenge_canonical: string;
  challenge_signature: string;
  wrap: {
    associated_data: CanonicalJsonValue;
    associated_data_canonical: string;
    nonce: string;
    ciphertext: string;
    expected_unwrapped_mek: string;
  };
};

type RecipientV2Vector = {
  meta: { synthetic_only: boolean; production_data: boolean };
  synthetic_key_material: {
    recipient_private_scalar: string;
    server_ephemeral_private_scalar: string;
    owner_ephemeral_private_scalar: string;
  };
  recipient_key: { public_key: string };
  possession: {
    challenge: RecipientPossessionChallengeV2;
    canonical_challenge: string;
    salt: string;
    expected_mac: string;
  };
  grant: {
    plaintext: RecipientGrantPlaintextV2;
    canonical_plaintext: string;
    associated_data: CanonicalJsonValue;
    canonical_associated_data: string;
    wrap_salt: string;
    nonce: string;
    expected_wrap_key: string;
    expected_ciphertext: string;
    envelope: RecipientGrantEnvelopeV2;
  };
};

type StateVector = {
  transition_matrix: (
    Omit<ClaimTransitionRequestV1, "protocol"> & { expected_allowed: boolean }
  )[];
};

type ReleaseCase = {
  manifest: ReleaseManifestV1;
  canonical_manifest: string;
  detached_signature: string;
};

type ReleaseVector = {
  signing_key: { public_key: string };
  registered_recipient: ReleaseCase;
  offline_code: ReleaseCase;
};

beforeAll(async () => {
  await sodium.ready;
});

describe("claim protocol vectors", () => {
  it("opens and validates the captured registered-recipient grant", () => {
    const fixture = vector<RecipientVector>("recipient-grant-v1.json");
    expect(fixture.meta).toMatchObject({
      synthetic_only: true,
      production_data: false,
    });
    assertRecipientGrantPlaintextV1(fixture.plaintext);
    assertRecipientGrantEnvelopeV1(fixture.envelope);

    const opened = sodium.crypto_box_seal_open(
      fromBase64url(fixture.captured_sealed_box_ciphertext),
      fromBase64url(fixture.key_material.recipient_public_key),
      fromBase64url(fixture.key_material.recipient_private_key),
    );
    expect(sodium.to_string(opened)).toBe(canonicalJson(fixture.plaintext));
    expect(opened).toEqual(fromBase64url(fixture.canonical_plaintext));

    const wrong = sodium.crypto_box_seed_keypair(new Uint8Array(32).fill(9));
    expect(() =>
      sodium.crypto_box_seal_open(
        fromBase64url(fixture.captured_sealed_box_ciphertext),
        wrong.publicKey,
        wrong.privateKey,
      ),
    ).toThrow();

    const truncated = fromBase64url(
      fixture.captured_sealed_box_ciphertext,
    ).slice(0, -1);
    expect(() =>
      sodium.crypto_box_seal_open(
        truncated,
        fromBase64url(fixture.key_material.recipient_public_key),
        fromBase64url(fixture.key_material.recipient_private_key),
      ),
    ).toThrow();

    expect({
      grant_id: fixture.plaintext.grant_id,
      recipient_id: fixture.plaintext.recipient_id,
      recipient_key_id: fixture.plaintext.recipient_key_id,
    }).not.toEqual({
      grant_id: "40000000-0000-4000-8000-000000000099",
      recipient_id: fixture.plaintext.recipient_id,
      recipient_key_id: fixture.plaintext.recipient_key_id,
    });
  });

  it("verifies the synthetic-only V2 proof and unwraps the MEK", () => {
    const fixture = vector<OfflineVector>("offline-code-v2.json");
    expect(fixture.meta.synthetic_only).toBe(true);
    assertOfflineCodeKdfProfileV2(fixture.kdf_profile);
    expect(fixture.kdf_profile.production_approved).toBe(false);
    assertOfflineCodeChallengeV2(fixture.challenge);
    expect(canonicalJson(fixture.challenge)).toBe(
      sodium.to_string(fromBase64url(fixture.challenge_canonical)),
    );
    expect(
      sodium.crypto_sign_verify_detached(
        fromBase64url(fixture.challenge_signature),
        fromBase64url(fixture.challenge_canonical),
        fromBase64url(fixture.derived.proof_public_key),
      ),
    ).toBe(true);

    expect(canonicalJson(fixture.wrap.associated_data)).toBe(
      sodium.to_string(fromBase64url(fixture.wrap.associated_data_canonical)),
    );
    const opened = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      fromBase64url(fixture.wrap.ciphertext),
      fromBase64url(fixture.wrap.associated_data_canonical),
      fromBase64url(fixture.wrap.nonce),
      fromBase64url(fixture.derived.wrap_key),
    );
    expect(opened).toEqual(fromBase64url(fixture.wrap.expected_unwrapped_mek));

    const changedChallenge = {
      ...fixture.challenge,
      origin: "https://hostile.sanduqkin.test",
    };
    expect(
      sodium.crypto_sign_verify_detached(
        fromBase64url(fixture.challenge_signature),
        sodium.from_string(canonicalJson(changedChallenge)),
        fromBase64url(fixture.derived.proof_public_key),
      ),
    ).toBe(false);

    const changedAssociatedData = {
      ...(fixture.wrap.associated_data as Record<string, CanonicalJsonValue>),
      owner_id: "10000000-0000-4000-8000-000000000099",
    };
    expect(() =>
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        fromBase64url(fixture.wrap.ciphertext),
        sodium.from_string(canonicalJson(changedAssociatedData)),
        fromBase64url(fixture.wrap.nonce),
        fromBase64url(fixture.derived.wrap_key),
      ),
    ).toThrow();

    const changedCiphertext = fromBase64url(fixture.wrap.ciphertext);
    changedCiphertext[0] ^= 1;
    expect(() =>
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        changedCiphertext,
        fromBase64url(fixture.wrap.associated_data_canonical),
        fromBase64url(fixture.wrap.nonce),
        fromBase64url(fixture.derived.wrap_key),
      ),
    ).toThrow();
  });

  it("verifies P-256 possession and opens the registered-recipient V2 grant", () => {
    const fixture = vector<RecipientV2Vector>("recipient-grant-v2.json");
    expect(fixture.meta).toMatchObject({
      synthetic_only: true,
      production_data: false,
    });
    assertRecipientPossessionChallengeV2(fixture.possession.challenge);
    assertRecipientGrantPlaintextV2(fixture.grant.plaintext);
    assertRecipientGrantEnvelopeV2(fixture.grant.envelope);
    expect(canonicalJson(fixture.possession.challenge)).toBe(
      sodium.to_string(fromBase64url(fixture.possession.canonical_challenge)),
    );
    expect(canonicalJson(fixture.grant.associated_data)).toBe(
      sodium.to_string(fromBase64url(fixture.grant.canonical_associated_data)),
    );

    const recipientPrivate = fromBase64url(
      fixture.synthetic_key_material.recipient_private_scalar,
    );
    const possessionShared = p256Secret(
      fixture.synthetic_key_material.recipient_private_scalar,
      fixture.possession.challenge.server_ephemeral_public_key,
    );
    const possessionMacKey = hkdfSha256(
      possessionShared,
      fromBase64url(fixture.possession.salt),
      new TextEncoder().encode("sanduqkin:claim:recipient-possession:v2"),
      32,
    );
    expect(
      hmacSha256(
        possessionMacKey,
        fromBase64url(fixture.possession.canonical_challenge),
      ),
    ).toEqual(fromBase64url(fixture.possession.expected_mac));

    const grantShared = p256Secret(
      fixture.synthetic_key_material.owner_ephemeral_private_scalar,
      fixture.recipient_key.public_key,
    );
    const wrapKey = hkdfSha256(
      grantShared,
      fromBase64url(fixture.grant.wrap_salt),
      new TextEncoder().encode("sanduqkin:claim:recipient-grant-wrap:v2"),
      32,
    );
    expect(wrapKey).toEqual(fromBase64url(fixture.grant.expected_wrap_key));
    const opened = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      fromBase64url(fixture.grant.expected_ciphertext),
      fromBase64url(fixture.grant.canonical_associated_data),
      fromBase64url(fixture.grant.nonce),
      wrapKey,
    );
    expect(opened).toEqual(fromBase64url(fixture.grant.canonical_plaintext));

    const changedAssociatedData = {
      ...(fixture.grant.associated_data as Record<string, CanonicalJsonValue>),
      recipient_key_version: 3,
    };
    expect(() =>
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        fromBase64url(fixture.grant.expected_ciphertext),
        sodium.from_string(canonicalJson(changedAssociatedData)),
        fromBase64url(fixture.grant.nonce),
        wrapKey,
      ),
    ).toThrow();

    recipientPrivate.fill(0);
  });

  it("matches every allowed and denied state pair", () => {
    const fixture = vector<StateVector>("claim-state-v1.json");
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

  it.each(["registered_recipient", "offline_code"] as const)(
    "verifies the %s signed release manifest",
    (route) => {
      const fixture = vector<ReleaseVector>("release-package-v1.json");
      const releaseCase = fixture[route];
      assertReleaseManifestV1(releaseCase.manifest);
      expect(canonicalJson(releaseCase.manifest)).toBe(
        sodium.to_string(fromBase64url(releaseCase.canonical_manifest)),
      );
      expect(
        sodium.crypto_sign_verify_detached(
          fromBase64url(releaseCase.detached_signature),
          fromBase64url(releaseCase.canonical_manifest),
          fromBase64url(fixture.signing_key.public_key),
        ),
      ).toBe(true);

      const changedManifest = {
        ...releaseCase.manifest,
        cancellation_version:
          releaseCase.manifest.cancellation_version + 1,
      };
      expect(
        sodium.crypto_sign_verify_detached(
          fromBase64url(releaseCase.detached_signature),
          sodium.from_string(canonicalJson(changedManifest)),
          fromBase64url(fixture.signing_key.public_key),
        ),
      ).toBe(false);
    },
  );

  it("rejects unknown protocol and route versions closed", () => {
    const recipient = vector<RecipientVector>("recipient-grant-v1.json");
    expect(() =>
      assertRecipientGrantPlaintextV1({
        ...(recipient.plaintext as object),
        protocol: "sanduqkin:claim:recipient-grant:v999",
      }),
    ).toThrow("unsupported");

    const release = vector<ReleaseVector>("release-package-v1.json");
    expect(() =>
      assertReleaseManifestV1({
        ...release.registered_recipient.manifest,
        release_material: { profile: "unknown_route_v999" },
      }),
    ).toThrow("unsupported");

    expect(() =>
      assertReleaseManifestV1({
        ...release.registered_recipient.manifest,
        release_material: {
          ...release.registered_recipient.manifest.release_material,
          profile: "offline_code_v2",
        },
      }),
    ).toThrow();
  });
});

function p256Secret(privateScalar: string, publicKey: string): Uint8Array {
  const agreement = createECDH("prime256v1");
  agreement.setPrivateKey(fromBase64url(privateScalar));
  return new Uint8Array(agreement.computeSecret(fromBase64url(publicKey)));
}

function hkdfSha256(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  outputLength: number,
): Uint8Array {
  const pseudorandomKey = hmacSha256(salt, inputKeyMaterial);
  let previous: Uint8Array = new Uint8Array();
  let output: Uint8Array = new Uint8Array();
  for (let counter = 1; output.length < outputLength; counter += 1) {
    previous = hmacSha256(
      pseudorandomKey,
      concat(previous, info, Uint8Array.of(counter)),
    );
    output = concat(output, previous);
  }
  return output.slice(0, outputLength);
}

function hmacSha256(key: Uint8Array, value: Uint8Array): Uint8Array {
  return new Uint8Array(createHmac("sha256", key).update(value).digest());
}

function concat(...values: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((total, value) => total + value.length, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}
