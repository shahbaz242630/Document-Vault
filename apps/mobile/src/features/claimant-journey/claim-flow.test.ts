import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encodeOfflineCodeSheetV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { createClaimFlow, type ClaimFlowSnapshot } from "./claim-flow";
import { createClaimantRuntimeBootstrap, mountDisabledClaimantRuntimeBootstrap } from "./runtime-bootstrap";
import { createClaimantRuntimeFoundation } from "./runtime-foundation";
import { harness } from "./runtime-foundation.fixtures.test";

const vector = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8"));
const sheet = encodeOfflineCodeSheetV2({ publicLocator: vector.public_locator,
  clientSecret: vector.synthetic_client_secret, kdfProfile: vector.kdf_profile, recordBinding: vector.record_binding });
const secret: string = vector.synthetic_client_secret.secret;

function world() {
  const h = harness();
  const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true, killSwitchEngaged: false,
    runtime: h.options, createRuntime: createClaimantRuntimeFoundation });
  const seen: ClaimFlowSnapshot[] = [];
  const flow = createClaimFlow({ handle: bootstrap.claimFlowRuntime(), newKey: randomUUID });
  flow.subscribe((snapshot) => { seen.push(snapshot); });
  const adapterCalls = () => [h.portalSend, h.possessionSend, h.handoffSend, h.signClaimantHandoffAsync]
    .map((mock) => mock.mock.calls.length);
  return { h, bootstrap, flow, seen, adapterCalls };
}

describe("claimant offline-code claim flow", () => {
  it("is unavailable in the normal application, which exposes no claim handle", async () => {
    const bootstrap = mountDisabledClaimantRuntimeBootstrap();
    expect(bootstrap.claimFlowRuntime()).toBeNull();
    const flow = createClaimFlow({ handle: bootstrap.claimFlowRuntime(), newKey: randomUUID });
    expect(flow.snapshot()).toEqual({ status: "unavailable", claim_started: false,
      identity_verified: false, release_authorized: false });
    await flow.submit(sheet);
    expect(flow.snapshot().status).toBe("unavailable");
  });

  it("starts a claim from a scanned emergency sheet and keeps only a value-free status", async () => {
    const w = world();
    await w.flow.submit(sheet);
    expect(w.seen.map((snapshot) => snapshot.status)).toEqual(["checking", "claim_started"]);
    expect(w.flow.snapshot()).toEqual({ status: "claim_started", claim_started: true,
      identity_verified: false, release_authorized: false });
    expect(w.h.portalSend.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert"]);
    expect(w.h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(JSON.stringify(w.seen)).not.toContain(secret);
    const keys = [w.h.portalSend, w.h.possessionSend, w.h.handoffSend].flatMap((mock) => mock.mock.calls)
      .map(([, init]) => (init as { headers?: Record<string, string> })?.headers?.["Idempotency-Key"]).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
    await w.bootstrap.dispose();
  });

  it("rejects an unrecognised sheet without contacting anything, then accepts a valid one", async () => {
    const w = world();
    await w.flow.submit(`${sheet.slice(0, -4)}AAAA`);
    await w.flow.submit("not a sheet");
    expect(w.flow.snapshot().status).toBe("sheet_not_recognised");
    expect(w.adapterCalls()).toEqual([0, 0, 0, 0]);
    await w.flow.submit(sheet);
    expect(w.flow.snapshot().status).toBe("claim_started");
    await w.bootstrap.dispose();
  });

  it("reports a generic failure once and does not retry on its own", async () => {
    const w = world(); w.h.possessionSend.mockRejectedValue(new Error("synthetic outage detail"));
    await w.flow.submit(sheet);
    expect(w.flow.snapshot().status).toBe("could_not_start");
    const calls = w.adapterCalls();
    await w.flow.submit(sheet);
    expect(w.adapterCalls()).toEqual(calls);
    expect(JSON.stringify(w.seen)).not.toMatch(/outage|detail/u);
    await w.bootstrap.dispose();
  });

  it.each(["kill switch", "background"])("closes with no claim when the %s interrupts native signing", async (fault) => {
    const w = world(); let finish!: (value: typeof w.h.nativeResult) => void;
    w.h.signClaimantHandoffAsync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = w.flow.submit(sheet);
    await vi.waitFor(() => expect(w.h.signClaimantHandoffAsync).toHaveBeenCalledOnce());
    if (fault === "kill switch") w.bootstrap.engageKillSwitch(); else w.bootstrap.handleAppState("background");
    finish(w.h.nativeResult);
    await pending;
    expect(w.flow.snapshot()).toMatchObject({ status: "closed", claim_started: false });
    expect(w.bootstrap.claimFlowRuntime()).toBeNull();
    const calls = w.adapterCalls();
    await w.flow.submit(sheet);
    expect(w.adapterCalls()).toEqual(calls);
  });

  it("stops notifying after disposal", async () => {
    const w = world();
    const pending = w.flow.submit(sheet); w.flow.dispose();
    await pending;
    expect(w.seen.map((snapshot) => snapshot.status)).toEqual(["checking"]);
    await w.bootstrap.dispose();
  });
});
