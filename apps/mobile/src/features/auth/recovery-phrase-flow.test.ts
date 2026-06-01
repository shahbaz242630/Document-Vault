import { describe, expect, it, vi } from "vitest";

import {
  completeRecoveryPhraseConfirmation,
  createMissingRecoveryPhraseSessionViewModel,
} from "./recovery-phrase-flow";

const words = [
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "abandon",
  "about",
];

describe("completeRecoveryPhraseConfirmation", () => {
  it("wraps and saves MEK key material before clearing the recovery phrase session", async () => {
    const mek = new Uint8Array([1, 2, 3]);
    const mekStorage = { set: vi.fn().mockResolvedValue(undefined) };
    const keyMaterialRepository = {
      saveKeyMaterial: vi.fn().mockResolvedValue(undefined),
    };
    const progressStorage = {
      load: vi.fn().mockResolvedValue({ email: "user@example.com", step: "confirm-recovery-phrase" }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const clearRecoveryPhraseSession = vi.fn();

    await completeRecoveryPhraseConfirmation({
      clearRecoveryPhraseSession,
      deriveKEK: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
      generateSalt: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
      keyMaterialRepository,
      mek,
      mekStorage,
      password: "correct horse battery staple",
      progressStorage,
      toBase64: async () => "encoded-mek",
      wrapMEK: vi.fn().mockResolvedValue({
        ciphertext: new Uint8Array([10, 11, 12]),
        nonce: new Uint8Array([13, 14, 15]),
      }),
    });

    expect(mekStorage.set).toHaveBeenCalledWith("encoded-mek");
    expect(keyMaterialRepository.saveKeyMaterial).toHaveBeenCalledWith({
      kdfAlgorithm: "argon2id",
      kdfParams: {
        keyLength: 32,
        memlimit: 268435456,
        opslimit: 3,
      },
      kekSalt: new Uint8Array([7, 8, 9]),
      recoveryVersion: 1,
      wrappedMek: {
        ciphertext: new Uint8Array([10, 11, 12]),
        nonce: new Uint8Array([13, 14, 15]),
      },
    });
    expect(progressStorage.save).toHaveBeenCalledWith({
      email: "user@example.com",
      step: "setup-biometric",
    });
    expect(clearRecoveryPhraseSession).toHaveBeenCalledTimes(1);
  });

  it("does not fail when signup progress is absent", async () => {
    const clearRecoveryPhraseSession = vi.fn();
    const progressStorage = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await completeRecoveryPhraseConfirmation({
      clearRecoveryPhraseSession,
      deriveKEK: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
      generateSalt: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
      keyMaterialRepository: {
        saveKeyMaterial: vi.fn().mockResolvedValue(undefined),
      },
      mek: new Uint8Array([1]),
      mekStorage: { set: vi.fn().mockResolvedValue(undefined) },
      password: "correct horse battery staple",
      progressStorage,
      toBase64: async () => "encoded-mek",
      wrapMEK: vi.fn().mockResolvedValue({
        ciphertext: new Uint8Array([10, 11, 12]),
        nonce: new Uint8Array([13, 14, 15]),
      }),
    });

    expect(progressStorage.save).not.toHaveBeenCalled();
    expect(clearRecoveryPhraseSession).toHaveBeenCalledTimes(1);
  });

  it("rejects empty password before storing the MEK", async () => {
    const mekStorage = { set: vi.fn().mockResolvedValue(undefined) };

    await expect(
      completeRecoveryPhraseConfirmation({
        clearRecoveryPhraseSession: vi.fn(),
        deriveKEK: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
        generateSalt: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
        keyMaterialRepository: {
          saveKeyMaterial: vi.fn().mockResolvedValue(undefined),
        },
        mek: new Uint8Array([1]),
        mekStorage,
        password: "   ",
        progressStorage: {
          load: vi.fn().mockResolvedValue(null),
          save: vi.fn().mockResolvedValue(undefined),
        },
        toBase64: async () => "encoded-mek",
        wrapMEK: vi.fn().mockResolvedValue({
          ciphertext: new Uint8Array([10, 11, 12]),
          nonce: new Uint8Array([13, 14, 15]),
        }),
      }),
    ).rejects.toThrow("Password is required to protect your vault key.");

    expect(mekStorage.set).not.toHaveBeenCalled();
  });
});

describe("createMissingRecoveryPhraseSessionViewModel", () => {
  it("returns restart copy when the in-memory phrase session is missing", () => {
    expect(createMissingRecoveryPhraseSessionViewModel()).toEqual({
      actionLabel: "Restart recovery phrase",
      body: "For your safety, recovery words are not stored in the URL. Start this step again to confirm a fresh phrase.",
      title: "Recovery phrase expired",
    });
  });
});
