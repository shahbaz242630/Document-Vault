import { z } from "zod";

import type { AssetPlaintextPayload } from "./asset-payload";

const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const contactFormSchema = z.object({
  country: requiredTextSchema,
  email: optionalTextSchema,
  name: requiredTextSchema,
  notes: optionalTextSchema,
  phone: optionalTextSchema,
  relationship: z.enum(["lawyer", "accountant", "employer", "embassy", "other"]),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;

export function createContactAssetPayload(values: ContactFormValues): AssetPlaintextPayload {
  const parsed = contactFormSchema.parse(values);

  return {
    assetType: "contact",
    fields: removeBlankFields({
      country: parsed.country,
      email: parsed.email,
      name: parsed.name,
      phone: parsed.phone,
      relationship: parsed.relationship,
    }),
    notes: parsed.notes,
    title: parsed.name,
  };
}

function removeBlankFields(fields: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
