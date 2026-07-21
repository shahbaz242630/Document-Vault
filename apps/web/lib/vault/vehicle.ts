import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebVehiclePayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("vehicle", values, existingFields);
