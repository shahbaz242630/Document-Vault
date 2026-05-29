import { z } from "zod";

import type { AssetPlaintextPayload } from "./asset-payload";

const costRangeSchema = z.enum([
  "under_50",
  "50_200",
  "200_500",
  "over_500",
  "prefer_not_to_say",
]);

const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const subscriptionFormSchema = z.object({
  approximateCostRange: costRangeSchema,
  country: requiredTextSchema,
  documentLocation: optionalTextSchema,
  notes: optionalTextSchema,
  subscriptionContact: optionalTextSchema,
  subscriptionType: z.enum(["streaming", "software", "utility", "other"]),
  serviceName: requiredTextSchema,
  title: requiredTextSchema,
});

export type SubscriptionFormValues = z.input<typeof subscriptionFormSchema>;

export function createSubscriptionAssetPayload(
  values: SubscriptionFormValues,
): AssetPlaintextPayload {
  const parsed = subscriptionFormSchema.parse(values);

  return {
    assetType: "subscription",
    fields: removeBlankFields({
      approximateCostRange: parsed.approximateCostRange,
      country: parsed.country,
      documentLocation: parsed.documentLocation,
      serviceName: parsed.serviceName,
      subscriptionType: parsed.subscriptionType,
    }),
    notes: parsed.notes,
    title: parsed.title,
  };
}

function removeBlankFields(fields: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
