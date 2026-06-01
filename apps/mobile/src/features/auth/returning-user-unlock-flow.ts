import type { VaultKeyMaterial } from "@/features/vault/supabase-vault-codec";
import type { WrappedMEK } from "@/shared/crypto/mek-wrapping";

type KeyMaterialRepository = {
  loadKeyMaterial: () => Promise<VaultKeyMaterial | null>;
};

type MekStorage = {
  set: (base64: string) => Promise<void>;
};

type UnlockReturningUserVaultInput = {
  deriveKEK: (password: string, salt: Uint8Array) => Promise<Uint8Array>;
  initializeVault: (keyBase64: string) => Promise<void>;
  keyMaterialRepository: KeyMaterialRepository;
  mekStorage: MekStorage;
  password: string;
  toBase64: (value: Uint8Array) => Promise<string>;
  unwrapMEK: (wrapped: WrappedMEK, kek: Uint8Array) => Promise<Uint8Array>;
};

export async function unlockReturningUserVault({
  deriveKEK,
  initializeVault,
  keyMaterialRepository,
  mekStorage,
  password,
  toBase64,
  unwrapMEK,
}: UnlockReturningUserVaultInput): Promise<void> {
  const keyMaterial = await keyMaterialRepository.loadKeyMaterial();

  if (!keyMaterial) {
    throw new Error("Vault key material has not been saved for this account.");
  }

  const kek = await deriveKEK(password, keyMaterial.kekSalt);
  const mek = await unwrapMEK(keyMaterial.wrappedMek, kek);
  const encodedMek = await toBase64(mek);

  await mekStorage.set(encodedMek);
  await initializeVault(encodedMek);
}
