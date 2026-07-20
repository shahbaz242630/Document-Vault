import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebPropertyPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("property", values, existingFields);
