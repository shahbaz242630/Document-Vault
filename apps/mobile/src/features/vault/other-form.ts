import { z } from "zod";

import type { AssetPlaintextPayload } from "./asset-payload";

const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const otherFormSchema = z.object({
  approximateValue: optionalTextSchema,
  category: optionalTextSchema,
  country: requiredTextSchema,
  description: optionalTextSchema,
  documentLocation: optionalTextSchema,
  notes: optionalTextSchema,
  title: requiredTextSchema,
});

export type OtherFormValues = z.input<typeof otherFormSchema>;

export function createOtherAssetPayload(values: OtherFormValues): AssetPlaintextPayload {
  const parsed = otherFormSchema.parse(values);

  return {
    assetType: "other",
    fields: removeBlankFields({
      approximateValue: parsed.approximateValue,
      category: parsed.category,
      country: parsed.country,
      description: parsed.description,
      documentLocation: parsed.documentLocation,
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
