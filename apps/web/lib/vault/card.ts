import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebCardPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("card", values, existingFields);
