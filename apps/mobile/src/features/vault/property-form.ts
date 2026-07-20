import type { PropertyFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { PropertyFormValues } from "@vault/shared-validation";
export const createPropertyAssetPayload = (values: PropertyFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("property", values);
