import {
  formatSchemaDrivenVaultSummary,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";

import type { VaultAssetPlaintext } from "@/lib/vault/crypto";

export function formatRecordSummary(payload: VaultAssetPlaintext) {
  const definition = getSchemaDrivenVaultCategory(payload.assetType);
  return definition ? formatSchemaDrivenVaultSummary(definition, payload.fields) : "";
}

export function formatAssetType(assetType: string) {
  return getSchemaDrivenVaultCategory(assetType)?.categoryLabel ?? "Vault record";
}
