import { z } from "zod";

const requiredTextSchema = z.string().trim().min(1);

const profileBasicsSchema = z.object({
  country: requiredTextSchema,
  firstName: requiredTextSchema,
  nationality: requiredTextSchema,
});

export type ProfileBasicsFormValues = z.input<typeof profileBasicsSchema>;
export type ProfileBasics = z.infer<typeof profileBasicsSchema>;

export function createProfileBasics(values: ProfileBasicsFormValues): ProfileBasics {
  return profileBasicsSchema.parse(values);
}
