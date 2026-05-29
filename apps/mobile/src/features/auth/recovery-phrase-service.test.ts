import { describe, expect, it } from "vitest";

import {
  deriveMasterKeyFromPhrase,
  generateRecoveryPhrase,
} from "./recovery-phrase-service";

describe("generateRecoveryPhrase", () => {
  it("returns 12 words from 128 bits of entropy", () => {
    let callCount = 0;
    const deterministicRandom: (length: number) => Uint8Array = (length) => {
      callCount++;
      return new Uint8Array(length).fill(callCount === 1 ? 0xab : 0xcd);
    };

    const phrase = generateRecoveryPhrase(deterministicRandom);

    expect(phrase).toHaveLength(12);
    expect(phrase.every((w) => w.length > 0)).toBe(true);
  });
});

describe("deriveMasterKeyFromPhrase", () => {
  it("derives a 32-byte key from a valid phrase", () => {
    const phrase = generateRecoveryPhrase(() =>
      crypto.getRandomValues(new Uint8Array(16)),
    );

    const key = deriveMasterKeyFromPhrase(phrase);

    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("derives the same key for the same phrase", () => {
    const phrase = [
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

    const keyA = deriveMasterKeyFromPhrase(phrase);
    const keyB = deriveMasterKeyFromPhrase(phrase);

    expect(keyA).toEqual(keyB);
  });

  it("throws on an invalid phrase", () => {
    expect(() => deriveMasterKeyFromPhrase(["not", "a", "valid", "phrase"])).toThrow(
      "Invalid recovery phrase.",
    );
  });
});
