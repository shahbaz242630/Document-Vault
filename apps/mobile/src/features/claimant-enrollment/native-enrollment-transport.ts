import {
  assertAppAttestAssertionChallengeV1,
  assertAppAttestAssertionResponseV1,
  assertAppAttestRegistrationChallengeV1,
  assertAppAttestRegistrationResponseV1,
  assertNativeEnrollmentChallengeRequestV1,
  assertNativeEnrollmentIssuedChallengeV1,
  assertNativeEnrollmentPossessionProofV1,
  canonicalJsonBytes,
  type AppAttestAssertionChallengeV1,
  type AppAttestAssertionResponseV1,
  type AppAttestRegistrationChallengeV1,
  type AppAttestRegistrationResponseV1,
  type NativeEnrollmentChallengeRequestV1,
  type NativeEnrollmentIssuedChallengeV1,
  type NativeEnrollmentPossessionProofV1,
} from "@vault/shared-types";
import { z } from "zod";

const MAX_RESPONSE_BYTES = 200_000;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const appAttestKeyId = z.string().regex(/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u);
const registrationResult = z.strictObject({ appAttestKeyRecordId: uuid, assertionCounter: z.number().int().nonnegative(), challengeId: uuid, replayed: z.boolean() });
const acceptanceResult = z.strictObject({ assertionCounter: z.number().int().positive(), caseId: uuid,
  caseVersion: z.number().int().positive(), claimantKeyId: uuid, invitationId: uuid,
  invitationVersion: z.number().int().positive(), replayed: z.boolean() });

export type NativeEnrollmentTransportV1 = Readonly<{
  completeNative(input: Readonly<{ appAttestChallengeId: string; appAttestResponse: AppAttestAssertionResponseV1;
    idempotencyKey: string; nativeChallengeId: string; possessionProof: NativeEnrollmentPossessionProofV1;
    signal?: AbortSignal }>): Promise<z.infer<typeof acceptanceResult>>;
  completeRegistration(input: Readonly<{ challengeId: string; idempotencyKey: string;
    response: AppAttestRegistrationResponseV1; signal?: AbortSignal }>): Promise<z.infer<typeof registrationResult>>;
  issueNative(input: Readonly<{ appAttestKeyId: string; idempotencyKey: string;
    request: Omit<NativeEnrollmentChallengeRequestV1, "policy_pack_id" | "policy_pack_version">;
    signal?: AbortSignal }>): Promise<Readonly<{ appAttestChallenge: AppAttestAssertionChallengeV1;
    appAttestChallengeBytes: string; native: NativeEnrollmentIssuedChallengeV1 }>>;
  issueRegistration(input: Readonly<{ appAttestKeyId: string; idempotencyKey: string;
    signal?: AbortSignal }>): Promise<Readonly<{ challenge: AppAttestRegistrationChallengeV1;
    challengeBytes: string }>>;
  reconcileNative(input: Readonly<{ appAttestChallengeId: string; attemptId: string;
    nativeChallengeId: string; signal?: AbortSignal }>): Promise<NativeEnrollmentReconciliationV1>;
}>;

export type NativeEnrollmentReconciliationV1 =
  | Readonly<{ status: "committed"; result: z.infer<typeof acceptanceResult> }>
  | Readonly<{ status: "not_committed" | "unknown" }>;

export class NativeEnrollmentTransportError extends Error {
  constructor(readonly kind: "aborted" | "authentication" | "conflict" | "invalid_response" | "rate_limited" | "unavailable") {
    super("Native enrollment request could not be completed."); this.name = "NativeEnrollmentTransportError";
  }
}

export function createNativeEnrollmentTransportV1(input: Readonly<{
  apiBaseUrl: string; fetch?: typeof fetch; getAccessToken: () => Promise<string | null>;
}>): NativeEnrollmentTransportV1 {
  const base = requireApiOrigin(input.apiBaseUrl);
  const post = async (path: string, body: unknown, idempotencyKey: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new NativeEnrollmentTransportError("aborted");
    const token = await input.getAccessToken();
    if (!token || token.length > 8_192 || /\s/u.test(token)) throw new NativeEnrollmentTransportError("authentication");
    let response: Response;
    try {
      response = await (input.fetch ?? fetch)(`${base}${path}`, { body: JSON.stringify(body), cache: "no-store",
        credentials: "omit", headers: { Accept: "application/json", Authorization: `Bearer ${token}`,
          "Content-Type": "application/json", "Idempotency-Key": requireUuid(idempotencyKey) },
        method: "POST", redirect: "error", signal });
    } catch (error) { throw new NativeEnrollmentTransportError(signal?.aborted || isAbort(error) ? "aborted" : "unavailable"); }
    if (!response.ok) throw new NativeEnrollmentTransportError(response.status === 401 || response.status === 403 ? "authentication"
      : response.status === 409 ? "conflict" : response.status === 429 ? "rate_limited" : "unavailable");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new NativeEnrollmentTransportError("invalid_response");
    try { return JSON.parse(text) as unknown; } catch { throw new NativeEnrollmentTransportError("invalid_response"); }
  };
  return {
    async issueRegistration(value) {
      if (!appAttestKeyId.safeParse(value.appAttestKeyId).success) invalidResponse();
      const raw = await post("/claimant/native-enrollment/app-attest/registration/challenges",
        { app_attest_key_id: value.appAttestKeyId }, value.idempotencyKey, value.signal);
      const result = unwrap(raw, z.strictObject({ challenge: z.unknown(), challenge_bytes: z.string() }));
      const challenge = assertAppAttestRegistrationChallengeV1(result.challenge);
      assertCanonicalBytes(result.challenge_bytes, challenge);
      return { challenge, challengeBytes: result.challenge_bytes };
    },
    async completeRegistration(value) {
      const validated = assertAppAttestRegistrationResponseV1(value.response);
      if (validated.challenge_id !== value.challengeId) invalidResponse();
      const raw = await post(`/claimant/native-enrollment/app-attest/registration/challenges/${requireUuid(value.challengeId)}/complete`,
        validated, value.idempotencyKey, value.signal);
      return unwrap(raw, registrationResult);
    },
    async issueNative(value) {
      if (!appAttestKeyId.safeParse(value.appAttestKeyId).success) invalidResponse();
      assertNativeEnrollmentChallengeRequestV1({ ...value.request, policy_pack_id: "client-validation-only",
        policy_pack_version: 1 });
      const raw = await post("/claimant/native-enrollment/challenges", { app_attest_key_id: value.appAttestKeyId,
        ...value.request }, value.idempotencyKey, value.signal);
      const result = unwrap(raw, z.strictObject({ app_attest_challenge: z.unknown(), app_attest_challenge_bytes: z.string(),
        native_challenge: z.unknown(), native_challenge_bytes: z.string() }));
      const appAttestChallenge = assertAppAttestAssertionChallengeV1(result.app_attest_challenge);
      assertCanonicalBytes(result.app_attest_challenge_bytes, appAttestChallenge);
      const native = assertNativeEnrollmentIssuedChallengeV1({ challenge: result.native_challenge,
        challenge_bytes: result.native_challenge_bytes });
      if (appAttestChallenge.claimant_id !== native.challenge.claimant_id ||
          appAttestChallenge.claimant_key_id !== native.challenge.claimant_key_id ||
          appAttestChallenge.invitation_reference !== native.challenge.invitation_reference ||
          appAttestChallenge.public_key_fingerprint !== native.challenge.public_key_fingerprint) invalidResponse();
      return { appAttestChallenge, appAttestChallengeBytes: result.app_attest_challenge_bytes, native };
    },
    async completeNative(value) {
      const appResponse = assertAppAttestAssertionResponseV1(value.appAttestResponse);
      const proof = assertNativeEnrollmentPossessionProofV1(value.possessionProof);
      if (appResponse.challenge_id !== value.appAttestChallengeId || proof.challenge_id !== value.nativeChallengeId) invalidResponse();
      const raw = await post(`/claimant/native-enrollment/challenges/${requireUuid(value.nativeChallengeId)}/complete`, {
        app_attest_challenge_id: requireUuid(value.appAttestChallengeId), app_attest_response: appResponse,
        possession_proof: proof }, value.idempotencyKey, value.signal);
      return unwrap(raw, acceptanceResult);
    },
    async reconcileNative(value) {
      const attemptId = requireUuid(value.attemptId);
      const raw = await post(`/claimant/native-enrollment/attempts/${attemptId}/reconcile`, {
        app_attest_challenge_id: requireUuid(value.appAttestChallengeId),
        native_challenge_id: requireUuid(value.nativeChallengeId),
      }, attemptId, value.signal);
      return unwrap(raw, reconciliationResult);
    },
  };
}

function unwrap<T>(value: unknown, schema: z.ZodType<T>): T {
  const wrapped = z.strictObject({ result: z.unknown() }).safeParse(value);
  const parsed = wrapped.success ? schema.safeParse(wrapped.data.result) : null;
  if (!parsed?.success) invalidResponse();
  return parsed.data;
}
function assertCanonicalBytes(bytes: string, value: object): void {
  if (bytes !== encodeBase64Url(canonicalJsonBytes(value as never))) invalidResponse();
}
function encodeBase64Url(value: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let output = "";
  for (let index = 0; index < value.length; index += 3) { const block = ((value[index] ?? 0) << 16) |
    ((value[index + 1] ?? 0) << 8) | (value[index + 2] ?? 0); output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += alphabet[(block >>> 6) & 63]; if (index + 2 < value.length) output += alphabet[block & 63]; }
  return output;
}
function requireApiOrigin(value: string): string { try { const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) throw new Error(); return value;
} catch { throw new Error("Native enrollment API origin is invalid."); } }
function requireUuid(value: string): string { if (!uuid.safeParse(value).success) throw new NativeEnrollmentTransportError("invalid_response"); return value; }
function invalidResponse(): never { throw new NativeEnrollmentTransportError("invalid_response"); }
function isAbort(error: unknown): boolean { return error instanceof Error && error.name === "AbortError"; }
const reconciliationResult = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("committed"), result: acceptanceResult }),
  z.strictObject({ status: z.literal("not_committed") }),
  z.strictObject({ status: z.literal("unknown") }),
]);
