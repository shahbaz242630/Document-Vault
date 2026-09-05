import { afterEach, describe, expect, it, vi } from "vitest";

import { HandoffUnavailableError } from "./contracts";
import { CLAIMANT_HANDOFF_COORDINATOR_APPROVED, createHandoffCoordinator } from "./coordinator";
import { attempt, completion, id, issue, now, session, signature, transcript } from "./fixtures.test";
import type { HandoffTransport } from "./transport";

function fixture() {
  const transport = { issue: vi.fn<HandoffTransport["issue"]>(async () => issue()),
    complete: vi.fn<HandoffTransport["complete"]>(async () => completion) };
  const signer = { syntheticOnly: true as const, sign: vi.fn(async () => signature) };
  const getSession = vi.fn(() => ({ ...session }));
  const clock = vi.fn(() => now);
  const client = createHandoffCoordinator({ approved: true, transport, signer, getSession, now: clock });
  return { client, transport, signer, getSession, clock };
}
afterEach(() => { vi.useRealTimers(); });
describe("disabled synthetic authenticated handoff coordinator", () => {
  it("does nothing by default", async () => {
    expect(CLAIMANT_HANDOFF_COORDINATOR_APPROVED).toBe(false);
    const f = fixture();
    const client = createHandoffCoordinator({ ...f, now: f.clock });
    await expect(client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    expect(f.getSession).not.toHaveBeenCalled(); expect(f.transport.issue).not.toHaveBeenCalled();
    expect(f.signer.sign).not.toHaveBeenCalled();
  });
  it("signs the exact server bytes and returns only a draft result", async () => {
    const f = fixture();
    expect(await f.client.start(attempt)).toEqual(completion);
    expect(f.signer.sign).toHaveBeenCalledWith({ transcriptBytesBase64url: issue().transcript_bytes_base64url,
      challengeId: attempt.challengeId, recordBindingDigest: attempt.recordBindingDigest, signal: expect.any(AbortSignal) });
    expect(f.transport.complete).toHaveBeenCalledWith({ handoffId: id(6), signature,
      idempotencyKey: attempt.completionIdempotencyKey, accessToken: session.accessToken, signal: expect.any(AbortSignal) });
    await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
  });
  it.each([
    ["claimant_user_id", id(8)], ["portal_session_id", id(8)], ["portal_session_version", 2],
    ["source_challenge_id", id(8)], ["record_binding_digest", "B".repeat(42) + "A"],
    ["handoff_id", id(8)], ["purpose", "possession_proof"], ["label", "old-domain"],
    ["expires_at_epoch", now / 1000], ["nonce", "bad"], ["extra", true],
  ])("rejects altered transcript %s before signing", async (field, value) => {
    const f = fixture(); f.transport.issue.mockResolvedValue(issue({ ...transcript, [field as string]: value }));
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    expect(f.signer.sign).not.toHaveBeenCalled(); expect(f.transport.complete).not.toHaveBeenCalled();
  });
  it.each([
    { userId: id(8) }, { sessionId: id(8) }, { sessionVersion: 2 }, { expiresAt: now },
    { assuredAt: now - 600_001 }, { assuredAt: now + 60_001 }, { recovery: true }, { aal: "aal1" },
  ])("rejects changed or unsafe sessions: %j", async (change) => {
    const f = fixture();
    f.getSession.mockReturnValueOnce(session).mockReturnValue({ ...session, ...change } as typeof session);
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    expect(f.signer.sign).not.toHaveBeenCalled(); expect(f.transport.complete).not.toHaveBeenCalled();
  });
  it("retries exactly once without signing again and reacquires a refreshed token", async () => {
    const f = fixture(); f.transport.complete.mockRejectedValueOnce(new HandoffUnavailableError(true));
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    f.getSession.mockReturnValue({ ...session, accessToken: "refreshed-synthetic-token" });
    expect(await f.client.retryCompletion()).toEqual(completion);
    const first = f.transport.complete.mock.calls[0]; const second = f.transport.complete.mock.calls[1];
    expect(second).toEqual([{ ...first[0], accessToken: "refreshed-synthetic-token", signal: expect.any(AbortSignal) }]);
    expect(f.signer.sign).toHaveBeenCalledOnce(); expect(f.transport.issue).toHaveBeenCalledOnce();
  });
  it("caps ambiguous sends at three and clears on exhaustion", async () => {
    const f = fixture(); f.transport.complete.mockRejectedValue(new HandoffUnavailableError(true));
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    for (let i = 0; i < 3; i++) await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
    expect(f.transport.complete).toHaveBeenCalledTimes(3);
  });
  it.each(["session", "expiry", "cancel", "clock"])("clears retry after %s", async (reason) => {
    const f = fixture(); f.transport.complete.mockRejectedValueOnce(new HandoffUnavailableError(true));
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    if (reason === "session") f.getSession.mockReturnValue({ ...session, sessionVersion: 2 });
    if (reason === "expiry") f.clock.mockReturnValue(now + 120_000);
    if (reason === "cancel") f.client.cancel();
    if (reason === "clock") f.clock.mockReturnValue(now - 1);
    await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
    expect(f.transport.complete).toHaveBeenCalledOnce();
  });
  it("drops pending completion at expiry even while idle", async () => {
    vi.useFakeTimers(); const f = fixture(); f.transport.complete.mockRejectedValueOnce(new HandoffUnavailableError(true));
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
    expect(f.transport.complete).toHaveBeenCalledOnce();
  });
  it.each(["issue", "sign", "complete"])("cancels a stalled %s and ignores late success", async (stage) => {
    const f = fixture(); let release!: (value: never) => void;
    const stalled = new Promise<never>((resolve) => { release = resolve; });
    if (stage === "issue") f.transport.issue.mockReturnValueOnce(stalled);
    if (stage === "sign") f.signer.sign.mockReturnValueOnce(stalled);
    if (stage === "complete") f.transport.complete.mockReturnValueOnce(stalled);
    const operation = f.client.start(attempt); const rejection = expect(operation).rejects.toThrow(HandoffUnavailableError);
    await vi.waitFor(() => expect(stage === "issue" ? f.transport.issue : stage === "sign" ? f.signer.sign : f.transport.complete)
      .toHaveBeenCalledOnce());
    await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    f.client.cancel(); await rejection;
    release((stage === "issue" ? issue() : stage === "sign" ? signature : completion) as never);
    await Promise.resolve();
    await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
  });
  it("times out a signer that ignores its abort signal", async () => {
    vi.useFakeTimers(); const f = fixture(); f.signer.sign.mockReturnValue(new Promise(() => undefined));
    const check = expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
    await vi.advanceTimersByTimeAsync(30_000); await check;
    expect(f.transport.complete).not.toHaveBeenCalled();
  });
  it("rejects terminal, cross-case, expanded and elevated completion results", async () => {
    for (const result of [{ ...completion, case_id: id(8) }, { ...completion, extra: true },
      { ...completion, release_authorized: true }]) {
      const f = fixture(); f.transport.complete.mockResolvedValue(result as typeof completion);
      await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
      await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
      expect(f.transport.complete).toHaveBeenCalledOnce();
    }
  });
  it("rejects account changes while signing or receiving completion", async () => {
    for (const stage of ["sign", "complete"]) {
      const f = fixture();
      const changeSession = () => f.getSession.mockReturnValue({ ...session, userId: id(8) });
      if (stage === "sign") f.signer.sign.mockImplementationOnce(async () => { changeSession(); return signature; });
      else f.transport.complete.mockImplementationOnce(async () => { changeSession(); return completion; });
      await expect(f.client.start(attempt)).rejects.toThrow(HandoffUnavailableError);
      await expect(f.client.retryCompletion()).rejects.toThrow(HandoffUnavailableError);
      if (stage === "sign") expect(f.transport.complete).not.toHaveBeenCalled();
    }
  });
  it("rejects non-synthetic inputs and reused idempotency keys", async () => {
    for (const value of [{ ...attempt, syntheticOnly: false },
      { ...attempt, completionIdempotencyKey: attempt.issueIdempotencyKey }, { ...attempt, caseId: id(8) }]) {
      const f = fixture(); await expect(f.client.start(value as typeof attempt)).rejects.toThrow(HandoffUnavailableError);
      expect(f.transport.issue).not.toHaveBeenCalled();
    }
  });
});
