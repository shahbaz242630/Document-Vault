export type ConfirmationChallenge = {
  position: number;
  word: string;
};

export function createConfirmationChallenge(
  words: readonly string[],
): ConfirmationChallenge[] {
  if (words.length !== 12) {
    throw new Error("Recovery phrase must have exactly 12 words.");
  }

  const indices = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  return indices.slice(0, 3).map((index) => ({
    position: index + 1,
    word: words[index],
  }));
}

export function validateConfirmationInputs(
  words: readonly string[],
  inputs: { position: number; value: string }[],
): boolean {
  return inputs.every(
    (input) =>
      words[input.position - 1]?.toLowerCase().trim() ===
      input.value.toLowerCase().trim(),
  );
}

function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
