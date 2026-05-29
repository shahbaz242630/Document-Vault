import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import { createVaultStore } from "./vault-store";

describe("vault store", () => {
  it("stores encrypted asset records and lists decrypted active assets", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({ now: () => new Date("2026-05-12T10:00:00.000Z") });

    const created = await store.addAsset({
      key,
      payload: {
        assetType: "bank_account",
        fields: {
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        title: "Primary bank reference",
      },
    });

    expect(created.assetType).toBe("bank_account");
    expect(created.deletedAt).toBeNull();
    expect(new TextDecoder().decode(created.encryptedPayload.ciphertext)).not.toContain(
      "Primary bank reference",
    );

    const activeAssets = await store.listActiveAssets({ key });

    expect(activeAssets).toEqual([
      {
        assetType: "bank_account",
        fields: {
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        id: created.id,
        notes: undefined,
        title: "Primary bank reference",
      },
    ]);
  });

  it("soft-deletes assets and excludes them from active listing", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({ now: () => new Date("2026-05-12T10:00:00.000Z") });
    const created = await store.addAsset({
      key,
      payload: {
        assetType: "insurance",
        fields: {
          provider: "Example Insurance",
        },
        title: "Life policy reference",
      },
    });

    const deleted = store.softDeleteAsset(created.id);

    expect(deleted?.deletedAt).toEqual("2026-05-12T10:00:00.000Z");
    await expect(store.listActiveAssets({ key })).resolves.toEqual([]);
    expect(store.listEncryptedRecords()).toHaveLength(1);
  });

  it("lists decrypted recently deleted assets with deletion timestamps", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({ now: () => new Date("2026-05-12T10:00:00.000Z") });
    const created = await store.addAsset({
      key,
      payload: {
        assetType: "property",
        fields: {
          location: "Dubai",
        },
        title: "Apartment reference",
      },
    });

    store.softDeleteAsset(created.id);

    await expect(store.listDeletedAssets({ key })).resolves.toEqual([
      {
        assetType: "property",
        deletedAt: "2026-05-12T10:00:00.000Z",
        fields: {
          location: "Dubai",
        },
        id: created.id,
        notes: undefined,
        title: "Apartment reference",
      },
    ]);
  });

  it("restores soft-deleted assets to the active list without changing ciphertext", async () => {
    const key = await generateMasterEncryptionKey();
    const dates = [
      new Date("2026-05-12T10:00:00.000Z"),
      new Date("2026-05-12T11:00:00.000Z"),
      new Date("2026-05-12T12:00:00.000Z"),
    ];
    const store = createVaultStore({ now: () => dates.shift() ?? dates[0] });
    const created = await store.addAsset({
      key,
      payload: {
        assetType: "subscription",
        fields: {
          provider: "Example Service",
        },
        title: "Streaming plan",
      },
    });
    store.softDeleteAsset(created.id);
    const deletedRecord = store.getEncryptedRecord(created.id);

    const restored = store.restoreAsset(created.id);

    expect(restored).toMatchObject({
      deletedAt: null,
      id: created.id,
      updatedAt: "2026-05-12T12:00:00.000Z",
    });
    expect(restored?.encryptedPayload.ciphertext).toEqual(deletedRecord?.encryptedPayload.ciphertext);
    await expect(store.listDeletedAssets({ key })).resolves.toEqual([]);
    await expect(store.listActiveAssets({ key })).resolves.toMatchObject([
      {
        assetType: "subscription",
        id: created.id,
        title: "Streaming plan",
      },
    ]);
  });

  it("permanently deletes only records that are already soft-deleted", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({ now: () => new Date("2026-05-12T10:00:00.000Z") });
    const active = await store.addAsset({
      key,
      payload: {
        assetType: "contact",
        fields: {
          name: "Accountant",
        },
        title: "Accountant contact",
      },
    });
    const deleted = await store.addAsset({
      key,
      payload: {
        assetType: "insurance",
        fields: {
          provider: "Example Insurance",
        },
        title: "Life policy reference",
      },
    });
    store.softDeleteAsset(deleted.id);

    expect(store.permanentlyDeleteAsset(active.id)).toBe(false);
    expect(store.permanentlyDeleteAsset(deleted.id)).toBe(true);

    expect(store.getEncryptedRecord(active.id)?.id).toBe(active.id);
    expect(store.getEncryptedRecord(deleted.id)).toBeNull();
    await expect(store.listDeletedAssets({ key })).resolves.toEqual([]);
  });

  it("updates an existing asset with a new encrypted payload and advances updatedAt", async () => {
    const key = await generateMasterEncryptionKey();
    const dates = [
      new Date("2026-05-12T10:00:00.000Z"),
      new Date("2026-05-12T11:00:00.000Z"),
    ];
    const store = createVaultStore({ now: () => dates.shift() ?? dates[0] });
    const created = await store.addAsset({
      key,
      payload: {
        assetType: "bank_account",
        fields: {
          institutionName: "Old Bank",
          lastFourDigits: "1234",
        },
        title: "Old reference",
      },
    });

    const updated = await store.updateAsset({
      id: created.id,
      key,
      payload: {
        assetType: "bank_account",
        fields: {
          institutionName: "New Bank",
          lastFourDigits: "5678",
        },
        title: "New reference",
      },
    });

    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.updatedAt).toBe("2026-05-12T11:00:00.000Z");
    expect(updated?.encryptedPayload.ciphertext).not.toEqual(
      created.encryptedPayload.ciphertext,
    );

    const activeAssets = await store.listActiveAssets({ key });
    expect(activeAssets).toMatchObject([
      {
        assetType: "bank_account",
        fields: {
          institutionName: "New Bank",
          lastFourDigits: "5678",
        },
        id: created.id,
        title: "New reference",
      },
    ]);
  });

  it("returns null when updating a non-existent asset", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore();

    const updated = await store.updateAsset({
      id: "non-existent",
      key,
      payload: {
        assetType: "bank_account",
        fields: {},
        title: "Test",
      },
    });

    expect(updated).toBeNull();
  });

  it("returns a copy of encrypted records so callers cannot mutate store state", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore();
    const created = await store.addAsset({
      key,
      payload: {
        assetType: "contact",
        fields: {
          name: "Accountant",
        },
        title: "Accountant contact",
      },
    });

    const records = store.listEncryptedRecords();
    records[0].deletedAt = "tampered";

    expect(store.getEncryptedRecord(created.id)?.deletedAt).toBeNull();
  });
});
