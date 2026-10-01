import sodium from "libsodium-wrappers-sumo";

import { decryptVaultPayload, encryptVaultPayload, fromBase64, toBase64 } from "@/shared/crypto/vault-crypto";

/*
 * PDF-first emergency sheets: the owner's own copy of a sheet, sealed with a subkey of the vault key so the sheet
 * can be shown and saved again. A sheet already carries a release wrap of the vault key, so a copy under that key
 * adds nothing for anyone who holds it. The subkey and the associated data bind each copy to one owner and one
 * sheet record; the key itself never leaves the vault session.
 */
const COPY_LABEL = "sanduqkin.owner-sheet-copy.v1";

export type OwnerSheetCopyAddress = Readonly<{ ownerId: string; locatorRecordId: string }>;
export type SealedOwnerSheetCopy = Readonly<{ nonce: string; ciphertext: string }>;

async function copyKey(key: Uint8Array): Promise<Uint8Array> {
  await sodium.ready;
  return sodium.crypto_generichash(32, sodium.from_string(COPY_LABEL), key);
}

function associatedData(address: OwnerSheetCopyAddress): string {
  return `${COPY_LABEL}:${address.ownerId}:${address.locatorRecordId}`;
}

export async function sealOwnerSheetCopy(input: OwnerSheetCopyAddress & Readonly<{
  key: Uint8Array; plaintext: string;
}>): Promise<SealedOwnerSheetCopy> {
  const sealed = await encryptVaultPayload({ associatedData: associatedData(input), key: await copyKey(input.key),
    plaintext: input.plaintext });
  return { ciphertext: await toBase64(sealed.ciphertext), nonce: await toBase64(sealed.nonce) };
}

/** Throws when the copy belongs to another owner or sheet, was changed, or was sealed under another vault key. */
export async function openOwnerSheetCopy(input: OwnerSheetCopyAddress & SealedOwnerSheetCopy & Readonly<{
  key: Uint8Array;
}>): Promise<string> {
  return decryptVaultPayload({ associatedData: associatedData(input), key: await copyKey(input.key),
    ciphertext: await fromBase64(input.ciphertext), nonce: await fromBase64(input.nonce) });
}
