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
  it("stores the MEK and clears in-memory recovery phrase session after confirmation", async () => {
    const mek = new Uint8Array([1, 2, 3]);
    const mekStorage = { set: vi.fn().mockResolvedValue(undefined) };
    const progressStorage = {
      load: vi.fn().mockResolvedValue({ email: "user@example.com", step: "confirm-recovery-phrase" }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const clearRecoveryPhraseSession = vi.fn();

    await completeRecoveryPhraseConfirmation({
      clearRecoveryPhraseSession,
      mek,
      mekStorage,
      progressStorage,
      toBase64: async () => "encoded-mek",
    });

    expect(mekStorage.set).toHaveBeenCalledWith("encoded-mek");
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
      mek: new Uint8Array([1]),
      mekStorage: { set: vi.fn().mockResolvedValue(undefined) },
      progressStorage,
      toBase64: async () => "encoded-mek",
    });

    expect(progressStorage.save).not.toHaveBeenCalled();
    expect(clearRecoveryPhraseSession).toHaveBeenCalledTimes(1);
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
