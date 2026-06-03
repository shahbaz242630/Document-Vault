import { describe, expect, it } from "vitest";

import { generateRandomBytes } from "@/shared/crypto/random-bytes";
import { generateMasterEncryptionKey, toBase64 } from "@/shared/crypto/vault-crypto";

import {
  unwrapKinGrantMEK,
  unwrapSealedEmergencyMEK,
  wrapMEKForKinGrant,
  wrapMEKWithEmergencyCode,
} from "./emergency-key-wrapping";

describe("emergency key wrapping", () => {
  it("round-trips a MEK through a sealed emergency code package", async () => {
    const mek = await generateMasterEncryptionKey();
    const packageResult = await wrapMEKWithEmergencyCode({
      emergencyCode: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek,
    });

    const unwrapped = await unwrapSealedEmergencyMEK({
      emergencyCode: "k7q9 m2xd 8v4p zr6t al3n",
      sealedPackage: packageResult.sealedPackage,
    });

    expect(unwrapped).toEqual(mek);
    expect(packageResult.sealedPackage.grantType).toBe("sealed_emergency_code");
    expect(packageResult.sealedPackage.kdf).toMatchObject({ algorithm: "argon2id" });
  });

  it("rejects the wrong sealed emergency code", async () => {
    const mek = await generateMasterEncryptionKey();
    const packageResult = await wrapMEKWithEmergencyCode({
      emergencyCode: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek,
    });

    await expect(
      unwrapSealedEmergencyMEK({
        emergencyCode: "B7Q9-M2XD-8V4P-ZR6T-AL3N",
        sealedPackage: packageResult.sealedPackage,
      }),
    ).rejects.toThrow("Vault payload could not be decrypted.");
  });

  it("does not serialize raw emergency code or plaintext MEK", async () => {
    const mek = await generateMasterEncryptionKey();
    const mekBase64 = await toBase64(mek);
    const packageResult = await wrapMEKWithEmergencyCode({
      emergencyCode: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek,
    });
    const serialized = JSON.stringify(packageResult.sealedPackage);

    expect(serialized).not.toContain("K7Q9");
    expect(serialized).not.toContain("M2XD");
    expect(serialized).not.toContain(mekBase64);
  });

  it("round-trips a MEK through a pre-authorized kin wrapping key", async () => {
    const mek = await generateMasterEncryptionKey();
    const kinWrappingKey = await generateRandomBytes(32);
    const grant = await wrapMEKForKinGrant({ kinWrappingKey, mek });

    const unwrapped = await unwrapKinGrantMEK({ grant, kinWrappingKey });

    expect(unwrapped).toEqual(mek);
    expect(grant.grantType).toBe("pre_authorized_kin");
    expect(grant.kdf).toBeNull();
  });

  it("rejects the wrong kin wrapping key", async () => {
    const mek = await generateMasterEncryptionKey();
    const grant = await wrapMEKForKinGrant({
      kinWrappingKey: await generateRandomBytes(32),
      mek,
    });

    await expect(
      unwrapKinGrantMEK({
        grant,
        kinWrappingKey: await generateRandomBytes(32),
      }),
    ).rejects.toThrow("Vault payload could not be decrypted.");
  });
});
