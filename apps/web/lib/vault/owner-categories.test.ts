import { schemaDrivenVaultCategories } from "@vault/shared-validation";
import { describe, expect, it } from "vitest";

import { isOwnerVaultAssetType, ownerVaultAssetTypes } from "./owner-categories";

describe("owner vault category discovery", () => {
  it("automatically includes every schema-driven category exactly once", () => {
    for (const definition of schemaDrivenVaultCategories) {
      expect(ownerVaultAssetTypes).toContain(definition.assetType);
      expect(ownerVaultAssetTypes.filter((assetType) => assetType === definition.assetType)).toHaveLength(1);
      expect(isOwnerVaultAssetType(definition.assetType)).toBe(true);
    }

    expect(new Set(ownerVaultAssetTypes).size).toBe(ownerVaultAssetTypes.length);
  });

  it("rejects categories outside the reviewed owner workspace", () => {
    expect(isOwnerVaultAssetType("beneficiary")).toBe(false);
    expect(isOwnerVaultAssetType(undefined)).toBe(false);
  });
});
