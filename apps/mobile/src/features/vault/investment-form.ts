import type { InvestmentFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { InvestmentFormValues } from "@vault/shared-validation";
export const createInvestmentAssetPayload = (values: InvestmentFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("investment", values);
