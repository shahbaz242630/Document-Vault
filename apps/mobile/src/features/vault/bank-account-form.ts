import type { BankAccountFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { BankAccountFormValues } from "@vault/shared-validation";
export const createBankAccountAssetPayload = (values: BankAccountFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("bank_account", values);
