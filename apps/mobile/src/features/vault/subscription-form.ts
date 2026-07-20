import type { SubscriptionFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { SubscriptionFormValues } from "@vault/shared-validation";
export const createSubscriptionAssetPayload = (values: SubscriptionFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("subscription", values);
