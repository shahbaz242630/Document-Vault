import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { decryptAssetPayload } from "@/features/vault/asset-payload";

import { deriveKEK } from "./kek-derivation";
import { unwrapMEK } from "./mek-wrapping";
import { fromBase64 } from "./vault-crypto";

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "../../test-fixtures/mobile-web-crypto-v1.json"), "utf8"));

describe("mobile/web crypto compatibility v1", () => {
  it("decrypts the shared deterministic fixture with the mobile implementation", async () => {
    const kek = await deriveKEK(fixture.password, await fromBase64(fixture.keyMaterial.kekSalt));
    const mek = await unwrapMEK({
      ciphertext: await fromBase64(fixture.keyMaterial.wrappedMekCiphertext),
      nonce: await fromBase64(fixture.keyMaterial.wrappedMekNonce),
    }, kek);
    const plaintext = await decryptAssetPayload({
      encrypted: {
        assetType: fixture.asset.assetType,
        ciphertext: await fromBase64(fixture.asset.ciphertext),
        nonce: await fromBase64(fixture.asset.nonce),
      },
      key: mek,
    });
    expect(plaintext).toEqual(fixture.plaintext);
  });
});
