import {
  contactVaultCategoryDefinition,
  createSchemaDrivenVaultPayload,
} from "@vault/shared-validation";

import type { VaultAssetPlaintext } from "./crypto";

export function createWebContactPayload(
  values: unknown,
  existingFields: Record<string, string> = {},
): VaultAssetPlaintext {
  return createSchemaDrivenVaultPayload(
    contactVaultCategoryDefinition,
    values,
    existingFields,
  );
}
