import { parseOfflineCodeSheetV2 } from "@vault/shared-types";

import { isClaimantPreviewBuild } from "../../shared/config/claimant-preview-build";

import {
  checkOfflineCodeV2ReleaseWrap,
  type OfflineCodeV2ProofCrypto,
  type OfflineCodeV2WrapCrypto,
} from "./offline-code-v2-proof-core";
import { offlineCodeV2PlatformSheetCrypto } from "./offline-code-v2-proof-producer";
import { generateOfflineCodeV2EmergencySheet } from "./offline-code-v2-sheet-generator";

/*
 * Slice 6H: the only importer of the 6F generator. The vault session calls it with its in-memory vault key; the
 * key never leaves this call. A sheet is returned only after the release wrap has been re-opened from the printed
 * material alone and shown to hold exactly that key.
 */
export const OWNER_OFFLINE_CODE_SHEET_APPROVED = false as const;

const VALIDITY_MS = 365 * 86_400_000;

export type OwnerOfflineCodeSheetRegistration = Readonly<{
  locatorRecordId: string; grantId: string; publicLocator: string; locatorCommitment: string;
  proofPublicKey: string; recordBindingDigest: string; kdfSalt: string; wrapNonce: string;
  wrapCiphertext: string; wrapAssociatedDataDigest: string; issuedAt: string; expiresAt: string;
}>;

export type OwnerOfflineCodeSheet = Readonly<{
  sheetPayload: string;
  printedLocator: string;
  printedSecret: string;
  expiresAt: string;
  registration: OwnerOfflineCodeSheetRegistration;
}>;

export type OwnerOfflineCodeSheetInput = Readonly<{
  ownerId: string;
  randomUUID: () => string;
  now?: () => Date;
}>;

export class OwnerOfflineCodeSheetError extends Error {
  constructor() {
    super("The emergency sheet could not be created.");
    this.name = "OwnerOfflineCodeSheetError";
  }
}

export async function createOwnerOfflineCodeSheet(input: OwnerOfflineCodeSheetInput & Readonly<{
  approved?: boolean;
  crypto?: OfflineCodeV2ProofCrypto & OfflineCodeV2WrapCrypto;
  mek: Uint8Array;
}>): Promise<OwnerOfflineCodeSheet> {
  const approved = input.approved ?? (OWNER_OFFLINE_CODE_SHEET_APPROVED || isClaimantPreviewBuild());
  if (!approved) throw new OwnerOfflineCodeSheetError();
  const crypto = input.crypto ?? offlineCodeV2PlatformSheetCrypto;
  try {
    const created = new Date(Math.floor((input.now?.() ?? new Date()).getTime() / 1000) * 1000);
    const createdAt = created.toISOString();
    const expiresAt = new Date(created.getTime() + VALIDITY_MS).toISOString();
    const sheet = await generateOfflineCodeV2EmergencySheet({ approved: true, syntheticOnly: true, crypto,
      ownerId: input.ownerId, grantId: input.randomUUID(), locatorRecordId: input.randomUUID(),
      mek: input.mek, createdAt, expiresAt });
    const parsed = parseOfflineCodeSheetV2(sheet.sheetPayload);
    const intact = await checkOfflineCodeV2ReleaseWrap({ approved: true, crypto, value: {
      ...parsed, wrapNonce: sheet.registration.wrapNonce, wrapCiphertext: sheet.registration.wrapCiphertext,
      wrapAssociatedDataDigest: sheet.registration.wrapAssociatedDataDigest, createdAt,
      expectedMek: input.mek } });
    if (!intact || sheet.registration.ownerUserId !== input.ownerId) throw new OwnerOfflineCodeSheetError();
    const { ownerUserId: _ownerUserId, ...registration } = sheet.registration;
    return Object.freeze({ sheetPayload: sheet.sheetPayload, printedLocator: sheet.printedLocator,
      printedSecret: sheet.printedSecret, expiresAt, registration: Object.freeze(registration) });
  } catch {
    throw new OwnerOfflineCodeSheetError();
  }
}
