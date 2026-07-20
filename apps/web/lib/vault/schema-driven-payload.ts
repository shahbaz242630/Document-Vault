import {
  createSchemaDrivenVaultPayload,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";
import type { AssetType } from "@vault/shared-types";

import type { VaultAssetPlaintext } from "./crypto";

export function createWebSchemaDrivenPayload(
  assetType: AssetType,
  values: unknown,
  existingFields: Record<string, string> = {},
): VaultAssetPlaintext {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  return createSchemaDrivenVaultPayload(definition, values, existingFields);
}
