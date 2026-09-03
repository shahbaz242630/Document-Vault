import { z } from "zod";

import type { ReleaseAuthorizationTransactionClientV1 }
  from "./release-authorization-transaction-client.js";

export const CLAIMANT_RELEASE_AUTHORIZATION_APPROVED = false as const;

export class ReleaseAuthorizationServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Release authorization is unavailable.");
    this.name = "ReleaseAuthorizationServiceError";
  }
}

export function createReleaseAuthorizationServiceV1(input: Readonly<{
  approved?: boolean; transactions: ReleaseAuthorizationTransactionClientV1;
}>) {
  return { async authorize(value: unknown) {
    if (!(input.approved ?? CLAIMANT_RELEASE_AUTHORIZATION_APPROVED)) {
      throw new ReleaseAuthorizationServiceError("disabled");
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ReleaseAuthorizationServiceError("invalid_input");
    return input.transactions.authorize(parsed.data);
  } };
}

const uuid = z.string().uuid();
const positive = z.number().int().positive();
const schema = z.strictObject({ authorityIdentityId: uuid, caseId: uuid, cycleId: uuid,
  expectedBindingVersion: positive, expectedCaseVersion: positive,
  expectedFinalizationVersion: positive, expectedRoundVersion: positive,
  idempotencyKey: uuid, reviewRoundId: uuid });
