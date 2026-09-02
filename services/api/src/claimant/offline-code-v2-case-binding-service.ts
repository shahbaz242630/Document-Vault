import { z } from "zod";

import type { OfflineCodeV2CaseBindingInput }
  from "./offline-code-v2-case-binding-transaction-client.js";

export const CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_APPROVED = false as const;

export class OfflineCodeV2CaseBindingServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "boundary_failure") {
    super("Offline-code V2 case binding is unavailable.");
    this.name = "OfflineCodeV2CaseBindingServiceError";
  }
}

type Transaction = Readonly<{
  bind(input: OfflineCodeV2CaseBindingInput): Promise<unknown>;
}>;

export function createOfflineCodeV2CaseBindingService(input: Readonly<{
  approved?: boolean;
  transaction: Transaction;
}>) {
  return {
    async bind(value: unknown) {
      if (!(input.approved ?? CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_APPROVED)) {
        throw new OfflineCodeV2CaseBindingServiceError("disabled");
      }
      const parsed = requestSchema.safeParse(value);
      if (!parsed.success) throw new OfflineCodeV2CaseBindingServiceError("invalid_input");
      try {
        return await input.transaction.bind(parsed.data);
      } catch (error) {
        if (error instanceof OfflineCodeV2CaseBindingServiceError) throw error;
        throw new OfflineCodeV2CaseBindingServiceError("boundary_failure");
      }
    },
  };
}

const requestSchema = z.strictObject({
  caseId: z.string().uuid(),
  claimantUserId: z.string().uuid(),
  portalSessionId: z.string().uuid(),
  challengeId: z.string().uuid(),
  expectedRecordBindingDigest: z.string()
    .regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u),
  policyPackId: z.literal("synthetic_policy_death_alpha"),
  policyPackVersion: z.literal(1),
  idempotencyKey: z.string().uuid(),
});
