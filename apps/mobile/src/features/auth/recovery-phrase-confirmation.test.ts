import { describe, expect, it } from "vitest";

import {
  createConfirmationChallenge,
  validateConfirmationInputs,
} from "./recovery-phrase-confirmation";

describe("createConfirmationChallenge", () => {
  it("returns 3 unique challenges from a 12-word phrase", () => {
    const words = Array.from({ length: 12 }, (_, i) => `word${i + 1}`);
    const challenges = createConfirmationChallenge(words);

    expect(challenges).toHaveLength(3);

    const positions = challenges.map((c) => c.position);
    expect(new Set(positions).size).toBe(3);
    positions.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(12);
    });
  });

  it("includes the correct word for each position", () => {
    const words = Array.from({ length: 12 }, (_, i) => `word${i + 1}`);
    const challenges = createConfirmationChallenge(words);

    challenges.forEach((challenge) => {
      expect(challenge.word).toBe(words[challenge.position - 1]);
    });
  });

  it("throws if the phrase does not have exactly 12 words", () => {
    expect(() => createConfirmationChallenge(["one", "two"])).toThrow(
      "Recovery phrase must have exactly 12 words.",
    );
  });
});

describe("validateConfirmationInputs", () => {
  it("returns true when all inputs match the phrase", () => {
    const words = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "honeydew", "kiwi", "lemon", "mango", "nectarine"];

    const isValid = validateConfirmationInputs(words, [
      { position: 1, value: "apple" },
      { position: 3, value: "cherry" },
      { position: 5, value: "elderberry" },
    ]);

    expect(isValid).toBe(true);
  });

  it("returns false when any input does not match", () => {
    const words = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "honeydew", "kiwi", "lemon", "mango", "nectarine"];

    const isValid = validateConfirmationInputs(words, [
      { position: 1, value: "apple" },
      { position: 3, value: "wrong" },
      { position: 5, value: "elderberry" },
    ]);

    expect(isValid).toBe(false);
  });

  it("ignores case and extra whitespace", () => {
    const words = ["Apple", "Banana", "Cherry", "date", "elderberry", "fig", "grape", "honeydew", "kiwi", "lemon", "mango", "nectarine"];

    const isValid = validateConfirmationInputs(words, [
      { position: 1, value: "  APPLE  " },
      { position: 2, value: "banana" },
      { position: 3, value: "CHERRY" },
    ]);

    expect(isValid).toBe(true);
  });
});
