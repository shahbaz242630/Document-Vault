import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import { createVaultSession } from "./vault-session";

describe("vault session", () => {
  it("adds an asset and lists it as a decrypted active asset", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({ key });

    const created = await session.addAsset({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      notes: "Use branch contact first.",
      title: "Primary family account",
    });

    await expect(session.listActiveAssets()).resolves.toEqual([
      {
        assetType: "bank_account",
        fields: {
          approximateValueRange: "prefer_not_to_say",
          country: "UAE",
          currency: "AED",
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        id: created.id,
        notes: "Use branch contact first.",
        title: "Primary family account",
      },
    ]);
  });

  it("moves soft-deleted assets from active assets to recently deleted assets", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({ key });
    const created = await session.addAsset({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      title: "Primary family account",
    });

    const deleted = session.softDeleteAsset(created.id);

    expect(deleted?.id).toBe(created.id);
    await expect(session.listActiveAssets()).resolves.toEqual([]);
    await expect(session.listDeletedAssets()).resolves.toMatchObject([
      {
        assetType: "bank_account",
        fields: {
          approximateValueRange: "prefer_not_to_say",
          country: "UAE",
          currency: "AED",
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        id: created.id,
        title: "Primary family account",
      },
    ]);
  });

  it("restores deleted assets back to the active asset list", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({ key });
    const created = await session.addAsset({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      title: "Primary family account",
    });
    session.softDeleteAsset(created.id);

    const restored = session.restoreAsset(created.id);

    expect(restored?.deletedAt).toBeNull();
    await expect(session.listDeletedAssets()).resolves.toEqual([]);
    await expect(session.listActiveAssets()).resolves.toMatchObject([
      {
        assetType: "bank_account",
        id: created.id,
        title: "Primary family account",
      },
    ]);
  });

  it("permanently deletes soft-deleted assets", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({ key });
    const created = await session.addAsset({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      title: "Primary family account",
    });

    expect(session.permanentlyDeleteAsset(created.id)).toBe(false);

    session.softDeleteAsset(created.id);

    expect(session.permanentlyDeleteAsset(created.id)).toBe(true);
    await expect(session.listActiveAssets()).resolves.toEqual([]);
    await expect(session.listDeletedAssets()).resolves.toEqual([]);
  });

  it("updates an existing asset with a new payload", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({ key });
    const created = await session.addAsset({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      title: "Primary family account",
    });

    const updated = await session.updateAsset(created.id, {
      assetType: "bank_account",
      fields: {
        approximateValueRange: "under_50k",
        country: "UAE",
        currency: "AED",
        institutionName: "Updated Bank",
        lastFourDigits: "5678",
      },
      notes: "Updated notes",
      title: "Updated title",
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated title");
    expect(updated?.fields.institutionName).toBe("Updated Bank");
    expect(updated?.fields.lastFourDigits).toBe("5678");

    const activeAssets = await session.listActiveAssets();
    expect(activeAssets).toHaveLength(1);
    expect(activeAssets[0]?.title).toBe("Updated title");
  });
});
