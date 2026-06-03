import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Vault export route", () => {
  it("passes encrypted vault records into the export screen preview", () => {
    const source = readFileSync(resolve(__dirname, "export.tsx"), "utf8");

    expect(source).toContain("const { assets, encryptedRecords, isReady } = useVaultSession();");
    expect(source).toContain("encryptedRecords={encryptedRecords}");
  });
});
