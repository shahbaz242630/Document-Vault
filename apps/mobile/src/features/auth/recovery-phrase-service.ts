import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";

export type GenerateRandomBytes = (length: number) => Uint8Array;

export function generateRecoveryPhrase(generateRandomBytes: GenerateRandomBytes): string[] {
  const entropy = generateRandomBytes(16); // 128 bits = 12 words
  const hex = Array.from(entropy)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const mnemonic = entropyToMnemonic(hex);
  return mnemonic.split(" ");
}

export function deriveMasterKeyFromPhrase(words: readonly string[]): Uint8Array {
  const mnemonic = words.join(" ");
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid recovery phrase.");
  }
  const seed = mnemonicToSeedSync(mnemonic);
  return new Uint8Array(seed.slice(0, 32));
}

export function generateRecoveryPhraseAndMEK(
  generateRandomBytes: GenerateRandomBytes,
): { mek: Uint8Array; words: string[] } {
  const words = generateRecoveryPhrase(generateRandomBytes);
  const mek = deriveMasterKeyFromPhrase(words);
  return { mek, words };
}
