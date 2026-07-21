import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebInvestmentPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("investment", values, existingFields);
