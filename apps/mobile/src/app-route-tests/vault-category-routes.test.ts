import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { vaultCategoryConfigs } from "../features/vault/vault-category-config";

describe("Vault category routes", () => {
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

  it("sends each add route to its matching category list after save", () => {
    for (const config of vaultCategoryConfigs) {
      const addRouteFile = resolve(
        __dirname,
        "../../app",
        `${config.addHref.replace("/vault/", "vault/")}.tsx`,
      );

      expect(existsSync(addRouteFile), `${config.addHref} route exists`).toBe(true);
      const source = readFileSync(addRouteFile, "utf8");

      if (source.includes("AddExpandedAssetRoute")) {
        expect(source).toContain(`assetType="${config.assetType}"`);
      } else {
        expect(source).toContain(config.routeHref);
      }
    }
  });
});
