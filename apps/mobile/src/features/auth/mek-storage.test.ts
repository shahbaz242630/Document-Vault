import { describe, expect, it } from "vitest";

import { createMekStorage } from "./mek-storage";

function createFakeStorage() {
  const data = new Map<string, string>();
  return {
    deleteItemAsync: async (key: string) => {
      data.delete(key);
    },
    getItemAsync: async (key: string) => data.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("mek-storage", () => {
  it("returns null when storage is null", async () => {
    const mekStorage = createMekStorage(null);
    expect(await mekStorage.get()).toBeNull();
  });

  it("returns null when no MEK has been stored", async () => {
    const mekStorage = createMekStorage(createFakeStorage());
    expect(await mekStorage.get()).toBeNull();
  });

  it("round-trips a MEK through storage", async () => {
    const mekStorage = createMekStorage(createFakeStorage());
    await mekStorage.set("base64-encoded-mek");
    expect(await mekStorage.get()).toBe("base64-encoded-mek");
  });

  it("clears the stored MEK", async () => {
    const mekStorage = createMekStorage(createFakeStorage());
    await mekStorage.set("base64-encoded-mek");
    await mekStorage.clear();
    expect(await mekStorage.get()).toBeNull();
  });

  it("no-ops set and clear when storage is null", async () => {
    const mekStorage = createMekStorage(null);
    await mekStorage.set("value");
    await mekStorage.clear();
    expect(await mekStorage.get()).toBeNull();
  });
});
