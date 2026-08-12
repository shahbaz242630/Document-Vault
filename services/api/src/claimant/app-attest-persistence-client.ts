import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { VerifiedAppAttestAssertionV1, VerifiedAppAttestRegistrationV1 } from "./app-attest-verifier.js";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export type AppAttestPersistenceClientV1 = Readonly<{
  advanceAssertion: (input: Readonly<{
    appAttestKeyIdDigest: string;
    claimantKeyId: string;
    claimantUserId: string;
    expectedPreviousCounter: number;
    idempotencyKey: string;
    portalSessionId: string;
    verified: VerifiedAppAttestAssertionV1;
  }>) => Promise<AppAttestPersistenceResultV1>;
  registerKey: (input: Readonly<{
    appIdHash: string;
    claimantUserId: string;
    idempotencyKey: string;
    portalSessionId: string;
    verified: VerifiedAppAttestRegistrationV1;
  }>) => Promise<AppAttestPersistenceResultV1>;
}>;

export type AppAttestPersistenceResultV1 = Readonly<{
  appAttestKeyRecordId: string;
  assertionCounter: number;
  replayed: boolean;
}>;

export class AppAttestPersistenceError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined) {
    super("App Attest persistence failed.");
    this.name = "AppAttestPersistenceError";
    this.code = code;
  }
}

export function createAppAttestPersistenceClientV1(rpc: Rpc): AppAttestPersistenceClientV1 {
  return {
    async advanceAssertion(input) {
      return readResult(await rpc("claimant_advance_app_attest_assertion", {
        p_app_attest_key_id_digest: input.appAttestKeyIdDigest,
        p_bundle_version: input.verified.bundleVersion,
        p_claimant_key_id: input.claimantKeyId,
        p_claimant_user_id: input.claimantUserId,
        p_expected_previous_counter: input.expectedPreviousCounter,
        p_idempotency_key: input.idempotencyKey,
        p_portal_session_id: input.portalSessionId,
        p_validation_category: input.verified.validationCategory,
        p_verified_counter: input.verified.counter,
      }));
    },
    async registerKey(input) {
      return readResult(await rpc("claimant_register_app_attest_key", {
        p_app_attest_key_id_digest: input.verified.appAttestKeyIdDigest,
        p_app_id_hash: input.appIdHash,
        p_attestation_receipt_base64: input.verified.receiptBase64,
        p_bundle_version: input.verified.bundleVersion,
        p_claimant_user_id: input.claimantUserId,
        p_environment: input.verified.environment,
        p_idempotency_key: input.idempotencyKey,
        p_portal_session_id: input.portalSessionId,
        p_public_key_spki_base64: input.verified.publicKeySpkiBase64,
        p_validation_category: input.verified.validationCategory,
      }));
    },
  };
}

export function createAppAttestSupabasePersistenceClientV1(config: Readonly<{
  serviceRoleKey: string;
  supabaseUrl: string;
}>): AppAttestPersistenceClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createAppAttestPersistenceClientV1((name, input) => supabase.rpc(name, input));
}

const resultSchema = z.strictObject({
  app_attest_key_record_id: z.string().uuid(),
  assertion_counter: z.number().int().min(0).max(4_294_967_295),
  replayed: z.boolean(),
});

function readResult(result: Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>): AppAttestPersistenceResultV1 {
  if (result.error) throw new AppAttestPersistenceError(result.error.code);
  const parsed = resultSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("App Attest persistence returned an invalid result.");
  return {
    appAttestKeyRecordId: parsed.data.app_attest_key_record_id,
    assertionCounter: parsed.data.assertion_counter,
    replayed: parsed.data.replayed,
  };
}
