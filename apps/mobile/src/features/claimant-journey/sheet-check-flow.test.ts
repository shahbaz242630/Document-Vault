import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encodeOfflineCodeSheetV2, type OfflineCodeSheetV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { classifySheetCheck, createSheetCheckFlow, sheetCheckView, type SheetCheckAttempt, type SheetCheckPort,
  type SheetCheckSeen, type SheetCheckStatus } from "./sheet-check-flow";

const vector = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8"));
const sheet: OfflineCodeSheetV2 = { publicLocator: vector.public_locator, clientSecret: vector.synthetic_client_secret,
  kdfProfile: vector.kdf_profile, recordBinding: vector.record_binding };
const sheetText = encodeOfflineCodeSheetV2(sheet);
const asserted = { status: "proof_verified", authority: "route_possession_only", route_possession_asserted: true,
  identity_verified: false, claim_created: false, release_authorized: false };
const none: SheetCheckSeen = { issued: false, proving: false, proofFailed: false, rejected: false, faulted: false };

function harness(run: (attempt: SheetCheckAttempt, seen: SheetCheckSeen) => Promise<unknown>) {
  let key = 0;
  const port = { start: vi.fn(run), cancel: vi.fn(), dispose: vi.fn(async () => undefined) } satisfies SheetCheckPort;
  const flow = createSheetCheckFlow({ port,
    newKey: () => `70000000-0000-4000-8000-00000000000${++key}` });
  const seenStatuses: SheetCheckStatus[] = [];
  flow.subscribe((snapshot) => { seenStatuses.push(snapshot.status); });
  return { port, flow, seenStatuses };
}

describe("claimant sheet check flow", () => {
  it("reports a sheet whose possession proof the server asserted as valid, and keeps nothing else", async () => {
    const h = harness(async (_attempt, seen) => { seen.issued = true; seen.proving = true; return asserted; });
    await h.flow.submit(sheetText);
    expect(h.seenStatuses).toEqual(["checking", "valid"]);
    const [attempt] = h.port.start.mock.calls[0];
    expect(attempt).toMatchObject({ syntheticOnly: true, publicLocator: sheet.publicLocator,
      challengeIdempotencyKey: "70000000-0000-4000-8000-000000000001",
      proofIdempotencyKey: "70000000-0000-4000-8000-000000000002" });
    expect(h.flow.snapshot()).toEqual({ status: "valid" });
    const kept = JSON.stringify([h.flow.snapshot(), Object.keys(h.flow), sheetCheckView("valid")]);
    for (const secret of [sheet.publicLocator.locator, sheet.clientSecret.secret, sheet.recordBinding.locator_record_id])
      expect(kept).not.toContain(secret);
  });

  it("reports a decoy challenge (the device never starts the proof) as a sheet that can't be used", async () => {
    const h = harness(async (_attempt, seen) => { seen.issued = true; throw new Error("private detail"); });
    await h.flow.submit(sheetText);
    expect(h.flow.snapshot().status).toBe("unusable");
    expect(h.port.cancel).toHaveBeenCalledOnce();
    expect(sheetCheckView("unusable").notice?.title).toBe("This sheet can't be used");
  });

  it("reports a refused proof and an unreadable sheet as can't be used", async () => {
    const refused = harness(async (_attempt, seen) => {
      Object.assign(seen, { issued: true, proving: true, rejected: true }); throw new Error();
    });
    await refused.flow.submit(sheetText);
    expect(refused.flow.snapshot().status).toBe("unusable");
    const unreadable = harness(async () => asserted);
    await unreadable.flow.submit("SKQ2.not-a-sheet");
    expect(unreadable.flow.snapshot().status).toBe("unusable");
    expect(unreadable.port.start).not.toHaveBeenCalled();
  });

  it("reports network, server and on-device failures as retryable, and try again returns to scanning", async () => {
    for (const flags of [{ faulted: true }, { issued: true, proving: true, proofFailed: true }, {}]) {
      const h = harness(async (_attempt, seen) => { Object.assign(seen, flags); throw new Error(); });
      await h.flow.submit(sheetText);
      expect(h.flow.snapshot().status).toBe("failed");
      expect(sheetCheckView("failed")).toMatchObject({ resetLabel: "Try again",
        notice: { title: "Something went wrong, try again" } });
      h.flow.reset();
      expect(h.flow.snapshot().status).toBe("ready");
    }
  });

  it("checks one scanned sheet at a time", async () => {
    let finish!: (value: unknown) => void;
    const h = harness(() => new Promise((done) => { finish = done; }));
    const first = h.flow.submit(sheetText);
    await h.flow.submit(sheetText); await h.flow.submit(sheetText);
    expect(h.port.start).toHaveBeenCalledOnce();
    finish(asserted); await first;
    await h.flow.submit(sheetText);
    expect(h.port.start).toHaveBeenCalledOnce();
    expect(h.flow.snapshot().status).toBe("valid");
  });

  it("aborts the check in flight on cancel and ignores its late result", async () => {
    let finish!: (value: unknown) => void;
    const h = harness(() => new Promise((done) => { finish = done; }));
    const pending = h.flow.submit(sheetText);
    expect(sheetCheckView(h.flow.snapshot().status).resetLabel).toBe("Cancel");
    h.flow.reset();
    expect(h.port.cancel).toHaveBeenCalledOnce();
    expect(h.flow.snapshot().status).toBe("ready");
    finish(asserted); await pending;
    expect(h.flow.snapshot().status).toBe("ready");
  });

  it("closes the check when the screen is left", async () => {
    let finish!: (value: unknown) => void;
    const h = harness(() => new Promise((done) => { finish = done; }));
    const pending = h.flow.submit(sheetText);
    h.flow.dispose(); h.flow.dispose();
    expect(h.port.cancel).toHaveBeenCalledOnce(); expect(h.port.dispose).toHaveBeenCalledOnce();
    finish(asserted); await pending;
    expect(h.seenStatuses).toEqual(["checking"]);
    await h.flow.submit(sheetText);
    expect(h.port.start).toHaveBeenCalledOnce();
  });

  it("is unavailable without a port and never offers the camera", async () => {
    const flow = createSheetCheckFlow({ port: null, newKey: () => "" });
    await flow.submit(sheetText); flow.reset();
    expect(flow.snapshot().status).toBe("unavailable");
    expect(sheetCheckView("unavailable")).toMatchObject({ scanLabel: null, resetLabel: null });
    expect(sheetCheckView("ready").scanLabel).toBe("Scan the QR code");
  });

  it("classifies from flags only", () => {
    expect(classifySheetCheck(true, none)).toBe("valid");
    expect(classifySheetCheck(false, none)).toBe("failed");
    expect(classifySheetCheck(false, { ...none, issued: true })).toBe("unusable");
    expect(classifySheetCheck(false, { ...none, issued: true, faulted: true })).toBe("failed");
    expect(classifySheetCheck(false, { ...none, issued: true, proving: true })).toBe("failed");
    expect(classifySheetCheck(false, { ...none, issued: true, proving: true, rejected: true })).toBe("unusable");
  });
});
