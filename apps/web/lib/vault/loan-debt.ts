import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebLoanDebtPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("loan_debt", values, existingFields);
