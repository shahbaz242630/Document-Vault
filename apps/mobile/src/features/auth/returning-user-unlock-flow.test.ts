import { describe, expect, it, vi } from "vitest";

import { unlockReturningUserVault } from "./returning-user-unlock-flow";

describe("unlockReturningUserVault", () => {
  it("unwraps persisted key material with the sign-in password and initializes the vault", async () => {
    const keyMaterial = {
      kdfAlgorithm: "argon2id" as const,
      kdfParams: {
        keyLength: 32 as const,
        memlimit: 268435456 as const,
        opslimit: 3 as const,
      },
      kekSalt: new Uint8Array([1, 2, 3]),
      recoveryVersion: 1,
      wrappedMek: {
        ciphertext: new Uint8Array([4, 5, 6]),
        nonce: new Uint8Array([7, 8, 9]),
      },
    };
    const deriveKEK = vi.fn().mockResolvedValue(new Uint8Array([10, 11, 12]));
    const initializeVault = vi.fn().mockResolvedValue(undefined);
    const mekStorage = { set: vi.fn().mockResolvedValue(undefined) };
    const unwrapMEK = vi.fn().mockResolvedValue(new Uint8Array([13, 14, 15]));

    await unlockReturningUserVault({
      deriveKEK,
      initializeVault,
      keyMaterialRepository: {
        loadKeyMaterial: vi.fn().mockResolvedValue(keyMaterial),
      },
      mekStorage,
      password: "correct horse battery staple",
      toBase64: vi.fn().mockResolvedValue("encoded-mek"),
      unwrapMEK,
    });

    expect(deriveKEK).toHaveBeenCalledWith("correct horse battery staple", keyMaterial.kekSalt);
    expect(unwrapMEK).toHaveBeenCalledWith(keyMaterial.wrappedMek, new Uint8Array([10, 11, 12]));
    expect(mekStorage.set).toHaveBeenCalledWith("encoded-mek");
    expect(initializeVault).toHaveBeenCalledWith("encoded-mek");
  });

  it("fails before vault initialization when key material is missing", async () => {
    const initializeVault = vi.fn().mockResolvedValue(undefined);

    await expect(
      unlockReturningUserVault({
        deriveKEK: vi.fn().mockResolvedValue(new Uint8Array([1])),
        initializeVault,
        keyMaterialRepository: {
          loadKeyMaterial: vi.fn().mockResolvedValue(null),
        },
        mekStorage: { set: vi.fn().mockResolvedValue(undefined) },
        password: "correct horse battery staple",
        toBase64: vi.fn().mockResolvedValue("encoded-mek"),
        unwrapMEK: vi.fn().mockResolvedValue(new Uint8Array([2])),
      }),
    ).rejects.toThrow("Vault key material has not been saved for this account.");

    expect(initializeVault).not.toHaveBeenCalled();
  });
});
