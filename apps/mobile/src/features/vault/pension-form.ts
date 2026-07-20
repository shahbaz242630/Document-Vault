import type { PensionFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { PensionFormValues } from "@vault/shared-validation";
export const createPensionAssetPayload = (values: PensionFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("pension", values);
