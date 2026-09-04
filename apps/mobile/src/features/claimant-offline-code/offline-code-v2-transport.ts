import {
  assertOfflineCodeChallengeV2,
  assertOfflineCodeKdfProfileV2,
  assertOfflineCodePossessionProofV2,
  canonicalJsonBytes,
  normalizeOfflineCodePublicLocatorV2,
  type OfflineCodeChallengeV2,
  type OfflineCodeKdfProfileV2,
  type OfflineCodePossessionProofV2,
} from "@vault/shared-types";
import { Buffer } from "buffer";
import { z } from "zod";

export const CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED = false as const;
const MAX_RESPONSE_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 15_000;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const authority = z.literal("route_possession_only");
const denied = { identity_verified: z.literal(false), claim_created: z.literal(false),
  release_authorized: z.literal(false) };
const challengeResult = z.strictObject({ status: z.literal("challenge_issued"), authority,
  challenge: z.unknown(), challenge_bytes_base64url: z.string().min(64).max(8_192),
  kdf_profile: z.unknown(), ...denied });
const proofResult = z.strictObject({ status: z.literal("proof_verified"), authority,
  route_possession_asserted: z.literal(true), ...denied });

export type OfflineCodeV2IssuedChallenge = Readonly<{
  challenge: OfflineCodeChallengeV2;
  challengeBytesBase64url: string;
  kdfProfile: OfflineCodeKdfProfileV2;
}>;
export type OfflineCodeV2PossessionResult = Readonly<z.infer<typeof proofResult>>;
export type OfflineCodeV2ProofRequest = Readonly<{
  challenge: OfflineCodeChallengeV2;
  challengeBytesBase64url: string;
  possessionProof: OfflineCodePossessionProofV2;
  idempotencyKey: string;
}>;
export type OfflineCodeV2Transport = Readonly<{
  issueChallenge(value: Readonly<{ locator: string; idempotencyKey: string; signal: AbortSignal }>):
    Promise<OfflineCodeV2IssuedChallenge>;
  verifyProof(value: OfflineCodeV2ProofRequest & Readonly<{ signal: AbortSignal }>):
    Promise<OfflineCodeV2PossessionResult>;
}>;
export type OfflineCodeV2Send = (url: string, init?: RequestInit) => Promise<Response>;

export class OfflineCodeV2UnavailableError extends Error {
  constructor(readonly retryable = false) {
    super("Offline-code request is unavailable.");
    this.name = "OfflineCodeV2UnavailableError";
  }
}

// There is deliberately no default network adapter or normal-runtime caller.
export function createOfflineCodeV2Transport(input: Readonly<{
  approved?: boolean;
  apiOrigin: string;
  claimantOrigin: string;
  send: OfflineCodeV2Send;
}>): OfflineCodeV2Transport {
  const approved = input.approved ?? CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED;
  const apiOrigin = input.apiOrigin;
  const claimantOrigin = input.claimantOrigin;
  const send = input.send;
  async function post(path: string, body: unknown, idempotencyKey: string, signal: AbortSignal) {
    if (!approved || signal.aborted) throw new OfflineCodeV2UnavailableError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    try {
      assertOfflineCodeV2Origin(apiOrigin);
      assertOfflineCodeV2Origin(claimantOrigin);
      if (apiOrigin === claimantOrigin) throw new Error();
      assertOfflineCodeV2IdempotencyKey(idempotencyKey);
      const text = JSON.stringify(body);
      if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw new Error();
      let response: Response;
      try {
        response = await abortable(send(`${apiOrigin}${path}`, {
          method: "POST", body: text, cache: "no-store", credentials: "omit", redirect: "error",
          referrerPolicy: "no-referrer", signal: controller.signal,
          headers: { Accept: "application/json", "Content-Type": "application/json",
            Origin: claimantOrigin, "Idempotency-Key": idempotencyKey },
        }).then((result) => {
          if (controller.signal.aborted) { discardBody(result); throw new OfflineCodeV2UnavailableError(true); }
          return result;
        }), controller.signal);
      } catch { throw new OfflineCodeV2UnavailableError(!signal.aborted); }
      if (response.status !== 200) {
        discardBody(response);
        throw new OfflineCodeV2UnavailableError(response.status >= 500);
      }
      if (response.redirected || (response.url && response.url !== `${apiOrigin}${path}`)
        || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
        || response.headers.get("cache-control") !== "no-store"
        || response.headers.get("access-control-allow-origin") !== claimantOrigin) {
        discardBody(response);
        throw new Error();
      }
      return await readBoundedJson(response, controller.signal);
    } catch (error) {
      if (error instanceof OfflineCodeV2UnavailableError) throw error;
      throw new OfflineCodeV2UnavailableError();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      controller.abort();
    }
  }
  return {
    async issueChallenge(value) {
      if (!approved) throw new OfflineCodeV2UnavailableError();
      try {
        normalizeOfflineCodePublicLocatorV2(value.locator);
        const raw = await post("/claimant/offline-code/v2/challenges", { locator: value.locator },
          value.idempotencyKey, value.signal);
        if (value.signal.aborted) throw new OfflineCodeV2UnavailableError();
        const result = z.strictObject({ result: challengeResult }).parse(raw).result;
        return validateOfflineCodeV2IssuedChallenge({ challenge: result.challenge,
          challengeBytesBase64url: result.challenge_bytes_base64url, kdfProfile: result.kdf_profile }, claimantOrigin);
      } catch (error) { throw safeError(error); }
    },
    async verifyProof(value) {
      if (!approved) throw new OfflineCodeV2UnavailableError();
      try {
        const request = validateOfflineCodeV2ProofRequest(value, claimantOrigin);
        const raw = await post(`/claimant/offline-code/v2/challenges/${request.challenge.challenge_id}/proofs`,
          { challenge: request.challenge, challenge_bytes_base64url: request.challengeBytesBase64url,
            possession_proof: request.possessionProof }, request.idempotencyKey, value.signal);
        if (value.signal.aborted) throw new OfflineCodeV2UnavailableError();
        return validateOfflineCodeV2PossessionResult(z.strictObject({ result: proofResult }).parse(raw).result);
      } catch (error) { throw safeError(error); }
    },
  };
}

export function validateOfflineCodeV2IssuedChallenge(value: unknown, origin: string): OfflineCodeV2IssuedChallenge {
  const result = z.strictObject({ challenge: z.unknown(), challengeBytesBase64url: z.string().min(64).max(8_192),
    kdfProfile: z.unknown() }).parse(value);
  assertOfflineCodeChallengeV2(result.challenge);
  assertOfflineCodeKdfProfileV2(result.kdfProfile);
  assertChallengeBytes(result.challenge, result.challengeBytesBase64url, origin);
  return Object.freeze({ challenge: Object.freeze({ ...result.challenge }),
    challengeBytesBase64url: result.challengeBytesBase64url, kdfProfile: Object.freeze({ ...result.kdfProfile }) });
}

export function validateOfflineCodeV2ProofRequest(value: OfflineCodeV2ProofRequest,
  origin: string): OfflineCodeV2ProofRequest {
  assertOfflineCodeV2IdempotencyKey(value.idempotencyKey);
  assertOfflineCodeChallengeV2(value.challenge);
  assertChallengeBytes(value.challenge, value.challengeBytesBase64url, origin);
  const proof = assertOfflineCodePossessionProofV2(value.possessionProof);
  for (const field of ["challenge_id", "locator_record_id", "locator_version", "proof_key_version",
    "proof_public_key", "record_binding_digest"] as const) {
    if (proof[field] !== value.challenge[field]) throw new Error();
  }
  return Object.freeze({ challenge: Object.freeze({ ...value.challenge }),
    challengeBytesBase64url: value.challengeBytesBase64url,
    possessionProof: Object.freeze({ ...proof }), idempotencyKey: value.idempotencyKey });
}

export function validateOfflineCodeV2PossessionResult(value: unknown): OfflineCodeV2PossessionResult {
  return Object.freeze(proofResult.parse(value));
}
export function assertOfflineCodeV2IdempotencyKey(value: string): void { uuid.parse(value); }
export function assertOfflineCodeV2Origin(value: string): void {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.origin !== value || parsed.username || parsed.password
    || value.length > 300) throw new Error();
}
function assertChallengeBytes(challenge: OfflineCodeChallengeV2, bytes: string, origin: string): void {
  assertOfflineCodeV2Origin(origin);
  // The mobile Buffer polyfill supports base64, but not Node's base64url encoding name.
  const canonical = Buffer.from(canonicalJsonBytes(challenge as never)).toString("base64")
    .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
  if (challenge.origin !== origin || challenge.locator_version !== 2 || challenge.proof_key_version !== 1
    || canonical !== bytes) throw new Error();
}
function safeError(error: unknown): OfflineCodeV2UnavailableError {
  return error instanceof OfflineCodeV2UnavailableError ? error : new OfflineCodeV2UnavailableError();
}
function discardBody(response: Response): void { void response.body?.cancel().catch(() => undefined); }

async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    discardBody(response);
    throw new Error();
  }
  // A later native binding must supply a bounded stream; do not fall back to unbounded text().
  const reader = response.body?.getReader();
  if (!reader) throw new Error();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let text = "";
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await abortable(reader.read(), signal); }
      catch { throw new OfflineCodeV2UnavailableError(true); }
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new Error();
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    if (declared !== null && Number(declared) !== length) throw new Error();
    return JSON.parse(text) as unknown;
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new OfflineCodeV2UnavailableError(true));
    // Attach rejection handling even if already aborted, so a late adapter error is consumed.
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
