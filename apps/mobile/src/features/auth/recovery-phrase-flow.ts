import type { SignupProgress } from "./signup-progress";
import type { VaultKeyMaterial } from "@/features/vault";
import type { WrappedMEK } from "@/shared/crypto/mek-wrapping";

type MekStorage = {
  set: (base64: string) => Promise<void>;
};

type KeyMaterialRepository = {
  saveKeyMaterial: (keyMaterial: VaultKeyMaterial) => Promise<unknown>;
};

type ProgressStorage = {
  load: () => Promise<SignupProgress | null>;
  save: (progress: SignupProgress) => Promise<void>;
};

type CompleteRecoveryPhraseConfirmationInput = {
  clearRecoveryPhraseSession: () => void;
  deriveKEK: (password: string, salt: Uint8Array) => Promise<Uint8Array>;
  generateSalt: () => Promise<Uint8Array>;
  keyMaterialRepository: KeyMaterialRepository | null;
  mek: Uint8Array;
  mekStorage: MekStorage;
  password: string;
  progressStorage: ProgressStorage;
  toBase64: (value: Uint8Array) => Promise<string>;
  wrapMEK: (mek: Uint8Array, kek: Uint8Array) => Promise<WrappedMEK>;
};

export async function completeRecoveryPhraseConfirmation({
  clearRecoveryPhraseSession,
  deriveKEK,
  generateSalt,
  keyMaterialRepository,
  mek,
  mekStorage,
  password,
  progressStorage,
  toBase64,
  wrapMEK,
}: CompleteRecoveryPhraseConfirmationInput): Promise<void> {
  if (password.trim().length === 0) {
    throw new Error("Password is required to protect your vault key.");
  }

  const salt = await generateSalt();
  const kek = await deriveKEK(password, salt);
  const wrappedMek = await wrapMEK(mek, kek);

  await keyMaterialRepository?.saveKeyMaterial({
    kdfAlgorithm: "argon2id",
    kdfParams: {
      keyLength: 32,
      memlimit: 268435456,
      opslimit: 3,
    },
    kekSalt: salt,
    recoveryVersion: 1,
    wrappedMek,
  });

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
