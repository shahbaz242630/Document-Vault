import { z } from "zod";

import type { AssetPlaintextPayload } from "./asset-payload";

const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const documentLocationFormSchema = z.object({
  country: requiredTextSchema,
  custodian: optionalTextSchema,
  documentType: z.enum(["will", "deed", "passport", "other"]),
  location: requiredTextSchema,
  notes: optionalTextSchema,
  title: requiredTextSchema,
});

export type DocumentLocationFormValues = z.input<typeof documentLocationFormSchema>;

export function createDocumentLocationAssetPayload(
  values: DocumentLocationFormValues,
): AssetPlaintextPayload {
  const parsed = documentLocationFormSchema.parse(values);

  return {
    assetType: "document_location",
    fields: removeBlankFields({
      country: parsed.country,
      custodian: parsed.custodian,
      documentType: parsed.documentType,
      location: parsed.location,
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
