import type { SignupProgress } from "./signup-progress";

type MekStorage = {
  set: (base64: string) => Promise<void>;
};

type ProgressStorage = {
  load: () => Promise<SignupProgress | null>;
  save: (progress: SignupProgress) => Promise<void>;
};

type CompleteRecoveryPhraseConfirmationInput = {
  clearRecoveryPhraseSession: () => void;
  mek: Uint8Array;
  mekStorage: MekStorage;
  progressStorage: ProgressStorage;
  toBase64: (value: Uint8Array) => Promise<string>;
};

export async function completeRecoveryPhraseConfirmation({
  clearRecoveryPhraseSession,
  mek,
  mekStorage,
  progressStorage,
  toBase64,
}: CompleteRecoveryPhraseConfirmationInput): Promise<void> {
  await mekStorage.set(await toBase64(mek));

  const existing = await progressStorage.load();
  if (existing) {
    await progressStorage.save({ ...existing, step: "setup-biometric" });
  }

  clearRecoveryPhraseSession();
}

export function createMissingRecoveryPhraseSessionViewModel() {
  return {
    actionLabel: "Restart recovery phrase",
    body: "For your safety, recovery words are not stored in the URL. Start this step again to confirm a fresh phrase.",
    title: "Recovery phrase expired",
  };
}
