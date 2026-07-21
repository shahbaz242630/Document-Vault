import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebPensionPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("pension", values, existingFields);
