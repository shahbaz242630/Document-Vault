import {
  createSchemaDrivenVaultPayload,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";

import type { AssetPlaintextPayload, AssetType } from "./asset-payload";

export function createMobileSchemaDrivenPayload(
  assetType: AssetType,
  values: unknown,
): AssetPlaintextPayload {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  return createSchemaDrivenVaultPayload(definition, values);
}
