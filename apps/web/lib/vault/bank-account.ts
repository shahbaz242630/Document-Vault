import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebBankAccountPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("bank_account", values, existingFields);
