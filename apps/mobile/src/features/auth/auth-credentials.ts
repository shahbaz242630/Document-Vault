import { z } from "zod";

const authCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters."),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthCredentialsInput = z.input<typeof authCredentialsSchema>;

export function createAuthCredentials(values: AuthCredentialsInput): AuthCredentials {
  return authCredentialsSchema.parse(values);
}
