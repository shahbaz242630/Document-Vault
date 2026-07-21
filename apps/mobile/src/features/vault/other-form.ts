import type { OtherFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { OtherFormValues } from "@vault/shared-validation";
export const createOtherAssetPayload = (values: OtherFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("other", values);
