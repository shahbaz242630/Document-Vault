import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebInsurancePayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("insurance", values, existingFields);
