import type { CryptoFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { CryptoFormValues } from "@vault/shared-validation";
export const createCryptoAssetPayload = (values: CryptoFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("crypto", values);
