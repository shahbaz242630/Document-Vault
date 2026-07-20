import type { InsuranceFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { InsuranceFormValues } from "@vault/shared-validation";
export const createInsuranceAssetPayload = (values: InsuranceFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("insurance", values);
