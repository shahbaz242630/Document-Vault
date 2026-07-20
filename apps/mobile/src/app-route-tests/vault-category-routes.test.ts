import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assetTypes } from "@vault/shared-types";
import { describe, expect, it } from "vitest";

import { vaultCategoryConfigs } from "../features/vault/vault-category-config";

describe("Vault category routes", () => {
  it("registers every shared asset type exactly once", () => {
    const configuredTypes = vaultCategoryConfigs.map(({ assetType }) => assetType);
    expect(new Set(configuredTypes)).toEqual(new Set(assetTypes));
    expect(configuredTypes).toHaveLength(assetTypes.length);
  });

  it("renders each saved-record category through the shared category route", () => {
    for (const config of vaultCategoryConfigs) {
      const routeFile = resolve(
        __dirname,
        "../../app",
        `${config.routeHref.replace("/vault/", "vault/")}.tsx`,
      );

      expect(existsSync(routeFile), `${config.routeHref} route exists`).toBe(true);
      expect(readFileSync(routeFile, "utf8")).toContain("VaultCategoryRoute");
    }
  });

  it("renders every add route through the shared schema-driven component", () => {
    for (const config of vaultCategoryConfigs) {
      const addRouteFile = resolve(
        __dirname,
        "../../app",
        `${config.addHref.replace("/vault/", "vault/")}.tsx`,
      );

      expect(existsSync(addRouteFile), `${config.addHref} route exists`).toBe(true);
      const source = readFileSync(addRouteFile, "utf8");

      expect(source).toContain("AddSchemaDrivenAssetRoute");
      expect(source).toContain(`assetType="${config.assetType}"`);
    }
  });
});
