import { z } from "zod";

export const lastFourDigitsSchema = z
  .string()
  .regex(/^\d{4}$/, "Enter exactly the last 4 digits.");
