import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import type { VaultEncryptedAssetRecord } from "./vault-store";
import { createVaultStore } from "./vault-store";
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

  it("generates UUID asset IDs by default for Supabase compatibility", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({ key });

    const created = await session.addAsset({
      assetType: "other",
      fields: {},
      title: "Default ID format",
    });

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
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

    const deleted = await session.softDeleteAsset(created.id);

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
    await session.softDeleteAsset(created.id);

    const restored = await session.restoreAsset(created.id);

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

  it("permanently deletes active assets without a restore window", async () => {
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

    await expect(session.permanentlyDeleteAsset(created.id)).resolves.toBe(true);
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

  it("loads encrypted records from a repository and decrypts them locally", async () => {
    const key = await generateMasterEncryptionKey();
    const seedStore = createVaultStore({
      generateId: () => "persisted-asset-1",
      now: () => new Date("2026-05-30T10:00:00.000Z"),
    });
    const encrypted = await seedStore.addAsset({
      key,
      payload: {
        assetType: "contact",
        fields: {
          country: "UAE",
          name: "Family lawyer",
        },
        notes: "Private instructions",
        title: "Legal contact",
      },
    });
    const repository = createRepositoryDouble([encrypted]);
    const session = createVaultSession({ key, repository });

    await session.loadPersistedAssets();

    await expect(session.listActiveAssets()).resolves.toEqual([
      {
        assetType: "contact",
        fields: {
          country: "UAE",
          name: "Family lawyer",
        },
        id: "persisted-asset-1",
        notes: "Private instructions",
        title: "Legal contact",
      },
    ]);
  });

  it("persists encrypted records when assets are added and updated", async () => {
    const key = await generateMasterEncryptionKey();
    const repository = createRepositoryDouble();
    const session = createVaultSession({
      key,
      repository,
      store: createVaultStore({
        generateId: () => "asset-1",
        now: () => new Date("2026-05-30T10:00:00.000Z"),
      }),
    });

    const created = await session.addAsset({
      assetType: "other",
      fields: {},
      notes: "Private note",
      title: "Important details",
    });
    await session.updateAsset(created.id, {
      assetType: "other",
      fields: {},
      notes: "Updated private note",
      title: "Updated details",
    });

    expect(repository.savedRecords).toHaveLength(2);
    expect(repository.savedRecords[0]?.id).toBe("asset-1");
    expect(JSON.stringify(repository.savedRecords)).not.toContain("Important details");
    expect(JSON.stringify(repository.savedRecords)).not.toContain("Private note");
    expect(JSON.stringify(repository.savedRecords)).not.toContain("Updated details");
    expect(JSON.stringify(repository.savedRecords)).not.toContain("Updated private note");
  });

  it("exposes encrypted storage preview records without plaintext vault fields", async () => {
    const key = await generateMasterEncryptionKey();
    const session = createVaultSession({
      key,
      store: createVaultStore({
        generateId: () => "asset-1",
        now: () => new Date("2026-06-03T10:00:00.000Z"),
      }),
    });

    await session.addAsset({
      assetType: "digital_account",
      fields: {
        provider: "Private Cloud",
        username: "family@example.com",
      },
      notes: "Recovery instructions",
      title: "Family cloud account",
    });

    const encryptedRecords = session.listEncryptedRecords();

    expect(encryptedRecords).toHaveLength(1);
    expect(encryptedRecords[0]).toMatchObject({
      assetType: "digital_account",
      createdAt: "2026-06-03T10:00:00.000Z",
      deletedAt: null,
      id: "asset-1",
      updatedAt: "2026-06-03T10:00:00.000Z",
    });
    expect(JSON.stringify(encryptedRecords)).not.toContain("Family cloud account");
    expect(JSON.stringify(encryptedRecords)).not.toContain("Private Cloud");
    expect(JSON.stringify(encryptedRecords)).not.toContain("family@example.com");
    expect(JSON.stringify(encryptedRecords)).not.toContain("Recovery instructions");
  });

  it("creates sealed emergency code setup without exposing the session MEK", async () => {
    const key = await generateMasterEncryptionKey();
    const repository = createEmergencyGrantRepositoryDouble();
    const session = createVaultSession({ key });

    const result = await session.createSealedEmergencyCodeSetup(repository, {
      codeGenerator: async () => "K7Q9-M2XD-8V4P-ZR6T-AL3N",
    });

    expect(result).toEqual({
      code: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      status: "pending_confirmation",
    });
    expect(repository.savedGrantCount).toBe(1);
    expect("getMek" in session).toBe(false);
  });

  it("persists direct permanent delete operations", async () => {
    const key = await generateMasterEncryptionKey();
    const repository = createRepositoryDouble();
    const session = createVaultSession({
      key,
      repository,
      store: createVaultStore({
        generateId: () => "asset-1",
        now: () => new Date("2026-05-30T10:00:00.000Z"),
      }),
    });
    await session.addAsset({
      assetType: "other",
      fields: {},
      title: "Important details",
    });

    const permanentlyDeleted = await session.permanentlyDeleteAsset("asset-1");

    expect(permanentlyDeleted).toBe(true);
    expect(repository.softDeletedAssets).toEqual([]);
    expect(repository.restoredAssets).toEqual([]);
    expect(repository.permanentlyDeletedAssetIds).toEqual(["asset-1"]);
  });
});

function createRepositoryDouble(initialRecords: VaultEncryptedAssetRecord[] = []) {
  const records = new Map(initialRecords.map((record) => [record.id, record]));
  const savedRecords: VaultEncryptedAssetRecord[] = [];
  const softDeletedAssets: Array<{ deletedAt: string; id: string; updatedAt: string }> = [];
  const restoredAssets: Array<{ id: string; updatedAt: string }> = [];
  const permanentlyDeletedAssetIds: string[] = [];

  return {
    permanentlyDeletedAssetIds,
    restoredAssets,
    savedRecords,
    softDeletedAssets,
    async listAssets() {
      return Array.from(records.values());
    },
    async permanentlyDeleteAsset(id: string) {
      permanentlyDeletedAssetIds.push(id);

      return records.delete(id);
    },
    async restoreAsset(input: { id: string; updatedAt: string }) {
      restoredAssets.push(input);
      const record = records.get(input.id);

      if (!record) {
        return null;
      }

      const restored = { ...record, deletedAt: null, updatedAt: input.updatedAt };
      records.set(input.id, restored);

      return restored;
    },
    async saveAsset(record: VaultEncryptedAssetRecord) {
      savedRecords.push(record);
      records.set(record.id, record);

      return record;
    },
    async softDeleteAsset(input: { deletedAt: string; id: string; updatedAt: string }) {
      softDeletedAssets.push(input);
      const record = records.get(input.id);

      if (!record) {
        return null;
      }

      const deleted = {
        ...record,
        deletedAt: input.deletedAt,
        updatedAt: input.updatedAt,
      };
      records.set(input.id, deleted);

      return deleted;
    },
  };
}

function createEmergencyGrantRepositoryDouble() {
  let savedGrantCount = 0;

  return {
    get savedGrantCount() {
      return savedGrantCount;
    },
    async revokeActiveSealedCodeGrants() {
      return undefined;
    },
    async saveSealedCodeGrant<T>(grant: T) {
      savedGrantCount += 1;

      return grant;
    },
  };
}
