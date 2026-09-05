import { z } from "zod";

import { assertOrigin, completionSchema, HandoffUnavailableError, issueSchema, sessionSchema,
  signatureSchema, uuid, type HandoffCompletion, type HandoffIssued } from "./contracts";

export const CLAIMANT_HANDOFF_TRANSPORT_APPROVED = false as const;
const MAX_RESPONSE_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 15_000;
type Request = Readonly<{ accessToken: string; idempotencyKey: string; signal: AbortSignal }>;
export type HandoffTransport = Readonly<{
  issue(value: Request & Readonly<{ challengeId: string }>): Promise<HandoffIssued>;
  complete(value: Request & Readonly<{ handoffId: string; signature: string }>): Promise<HandoffCompletion>;
}>;
export type HandoffSend = (url: string, init?: RequestInit) => Promise<Response>;

// Injected transport only: no ambient network, authentication, or storage adapter.
export function createHandoffTransport(input: Readonly<{
  approved?: boolean; apiOrigin: string; claimantOrigin: string; send: HandoffSend;
}>): HandoffTransport {
  const { apiOrigin, claimantOrigin, send } = input;
  const approved = input.approved ?? CLAIMANT_HANDOFF_TRANSPORT_APPROVED;
  async function post(action: "issue" | "complete", body: unknown, request: Request): Promise<unknown> {
    if (!approved || request.signal.aborted) throw new HandoffUnavailableError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
    request.signal.addEventListener("abort", abort, { once: true });
    try {
      assertOrigin(apiOrigin); assertOrigin(claimantOrigin);
      if (apiOrigin === claimantOrigin) throw new Error();
      uuid.parse(request.idempotencyKey);
      sessionSchema.shape.accessToken.parse(request.accessToken);
      const url = `${apiOrigin}/claimant/offline-code/v2/handoffs/${action}`;
      let response: Response;
      try {
        response = await abortable(send(url, {
          method: "POST", body: JSON.stringify(body), cache: "no-store", credentials: "omit", redirect: "error",
          referrerPolicy: "no-referrer", signal: controller.signal,
          headers: { Accept: "application/json", "Content-Type": "application/json", Origin: claimantOrigin,
            Authorization: `Bearer ${request.accessToken}`, "Idempotency-Key": request.idempotencyKey },
        }).then((result) => {
          if (controller.signal.aborted) { discard(result); throw new HandoffUnavailableError(true); }
          return result;
        }), controller.signal);
      } catch { throw new HandoffUnavailableError(!request.signal.aborted); }
      if (response.status !== 200) {
        discard(response); throw new HandoffUnavailableError(response.status >= 500);
      }
      if (response.redirected || (response.url && response.url !== url)
        || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
        || response.headers.get("cache-control") !== "private, no-store"
        || response.headers.get("access-control-allow-origin") !== claimantOrigin
        || response.headers.get("x-robots-tag") !== "noindex, nofollow") {
        discard(response); throw new Error();
      }
      const result = await readJson(response, controller.signal);
      if (request.signal.aborted || controller.signal.aborted) throw new HandoffUnavailableError();
      return result;
    } finally {
      clearTimeout(timer); request.signal.removeEventListener("abort", abort); controller.abort();
    }
  }
  return {
    async issue(value) {
      if (!approved) throw new HandoffUnavailableError();
      try {
        const body = { challengeId: uuid.parse(value.challengeId) };
        return Object.freeze(z.strictObject({ result: issueSchema }).parse(await post("issue", body, value)).result);
      } catch (error) { throw safeError(error); }
    },
    async complete(value) {
      if (!approved) throw new HandoffUnavailableError();
      try {
        const body = { handoffId: uuid.parse(value.handoffId), signature: signatureSchema.parse(value.signature) };
        return Object.freeze(z.strictObject({ result: completionSchema }).parse(await post("complete", body, value)).result);
      } catch (error) { throw safeError(error); }
    },
  };
}
function safeError(error: unknown): HandoffUnavailableError {
  return error instanceof HandoffUnavailableError ? error : new HandoffUnavailableError();
}
function discard(response: Response): void { void response.body?.cancel().catch(() => undefined); }
async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    discard(response); throw new Error();
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0; let text = "";
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new Error();
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    if (declared !== null && Number(declared) !== length) throw new Error();
    return JSON.parse(text) as unknown;
  } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new HandoffUnavailableError(true));
    void promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}
