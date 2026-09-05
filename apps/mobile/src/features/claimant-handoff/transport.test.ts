import { afterEach, describe, expect, it, vi } from "vitest";

import { HandoffUnavailableError } from "./contracts";
import { apiOrigin, attempt, claimantOrigin, completion, id, issue, response, session, signature } from "./fixtures.test";
import { CLAIMANT_HANDOFF_TRANSPORT_APPROVED, createHandoffTransport } from "./transport";

const request = () => ({ challengeId: attempt.challengeId, accessToken: session.accessToken,
  idempotencyKey: attempt.issueIdempotencyKey, signal: new AbortController().signal });
afterEach(() => vi.useRealTimers());
describe("authenticated handoff transport", () => {
  it("is disabled before network access", async () => {
    expect(CLAIMANT_HANDOFF_TRANSPORT_APPROVED).toBe(false);
    const send = vi.fn(); const transport = createHandoffTransport({ apiOrigin, claimantOrigin, send });
    await expect(transport.issue(request())).rejects.toThrow(HandoffUnavailableError); expect(send).not.toHaveBeenCalled();
  });
  it("uses fixed paths, bearer headers and strictly allowlisted bodies", async () => {
    const send = vi.fn(async () => response());
    const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send });
    expect(await transport.issue(request())).toEqual(issue());
    expect(send).toHaveBeenCalledWith(`${apiOrigin}/claimant/offline-code/v2/handoffs/issue`, expect.objectContaining({
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer",
      body: JSON.stringify({ challengeId: attempt.challengeId }), headers: expect.objectContaining({
        Authorization: `Bearer ${session.accessToken}`, Origin: claimantOrigin }) }));
    send.mockResolvedValue(response(completion));
    expect(await transport.complete({ ...request(), handoffId: id(6), signature })).toEqual(completion);
    expect(send).toHaveBeenLastCalledWith(`${apiOrigin}/claimant/offline-code/v2/handoffs/complete`, expect.objectContaining({
      body: JSON.stringify({ handoffId: id(6), signature }) }));
  });
  it.each(["http://api.test", "https://api.test/", "https://api.test/path", claimantOrigin])("rejects API origin %s", async (origin) => {
    const send = vi.fn(); const transport = createHandoffTransport({ approved: true, apiOrigin: origin, claimantOrigin, send });
    await expect(transport.issue(request())).rejects.toThrow(HandoffUnavailableError); expect(send).not.toHaveBeenCalled();
  });
  it.each(["bad token", "bad,token", "bad\r\nheader", "", "A".repeat(8193)])("rejects unsafe bearer input", async (accessToken) => {
    const send = vi.fn(); const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send });
    await expect(transport.issue({ ...request(), accessToken })).rejects.toThrow(HandoffUnavailableError);
    expect(send).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { "Cache-Control": "public" }, { "Access-Control-Allow-Origin": "*" },
    { "Content-Type": "text/html" }, { "X-Robots-Tag": "index" }, { "Content-Length": "16385" },
    { "Content-Length": "oops" }, { "Content-Length": "1" },
  ])("rejects unsafe response metadata %j", async (headers) => {
    const send = vi.fn(async () => response(issue(), headers));
    const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send });
    await expect(transport.issue(request())).rejects.toThrow(HandoffUnavailableError);
  });
  it("rejects expanded and authority-elevated response envelopes", async () => {
    for (const result of [{ ...issue(), extra: true }, { ...issue(), release_authorized: true },
      { ...issue(), claim_created: true }]) {
      const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send: async () => response(result) });
      await expect(transport.issue(request())).rejects.toThrow(HandoffUnavailableError);
    }
  });
  it("bounds streamed responses without trusting Content-Length", async () => {
    const oversized = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(16_385)); controller.close();
    } }), { headers: response().headers });
    const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send: async () => oversized });
    await expect(transport.issue(request())).rejects.toThrow(HandoffUnavailableError);
  });
  it.each([302, 403, 404, 429, 500, 503])("classifies HTTP %s without exposing its body", async (status) => {
    const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin,
      send: async () => new Response("sensitive diagnostic", { status }) });
    await expect(transport.issue(request())).rejects.toMatchObject({ message: "Offline-code handoff is unavailable.",
      retryable: status >= 500 });
  });
  it("times out network adapters and response streams that ignore abort", async () => {
    vi.useFakeTimers();
    for (const send of [() => new Promise<Response>(() => undefined), async () => new Response(new ReadableStream(),
      { headers: response().headers })]) {
      const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send });
      const check = expect(transport.issue(request())).rejects.toMatchObject({ retryable: true });
      await vi.advanceTimersByTimeAsync(15_000); await check;
    }
  });
  it("rejects pre-aborted sends and cancels an in-flight send", async () => {
    const send = vi.fn(() => new Promise<Response>(() => undefined));
    const transport = createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send });
    const controller = new AbortController(); controller.abort();
    await expect(transport.issue({ ...request(), signal: controller.signal })).rejects.toThrow(HandoffUnavailableError);
    expect(send).not.toHaveBeenCalled();
    const current = new AbortController();
    const check = expect(transport.issue({ ...request(), signal: current.signal })).rejects.toThrow(HandoffUnavailableError);
    current.abort(); await check;
  });
});
