import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { encodeOfflineCodeSheetV2, OFFLINE_CODE_V2_SHEET_MAX_LENGTH } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { createClaimFlow, type ClaimFlowSnapshot } from "./claim-flow";
import { createClaimSheetScan } from "./claim-sheet-scan";
import { claimScannerHelp, claimScannerView } from "./claim-sheet-scanner-view-model";
import { createClaimantRuntimeBootstrap } from "./runtime-bootstrap";
import { createClaimantRuntimeFoundation } from "./runtime-foundation";
import { harness } from "./runtime-foundation.fixtures.test";

const vector = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8"));
const sheet = encodeOfflineCodeSheetV2({ publicLocator: vector.public_locator,
  clientSecret: vector.synthetic_client_secret, kdfProfile: vector.kdf_profile, recordBinding: vector.record_binding });
const secret: string = vector.synthetic_client_secret.secret;

describe("claim sheet scan handler", () => {
  it("ignores other barcodes, foreign QR codes and over-long values, then passes one sheet on", () => {
    const submit = vi.fn();
    const scan = createClaimSheetScan(submit);
    scan.onScan({ type: "ean13", data: sheet });
    scan.onScan({ type: 256, data: sheet });
    scan.onScan({ type: "qr", data: "https://example.test/menu" });
    scan.onScan({ type: "qr", data: `SKQ2.${"A".repeat(OFFLINE_CODE_V2_SHEET_MAX_LENGTH)}` });
    scan.onScan({ type: "qr", data: undefined });
    expect(submit).not.toHaveBeenCalled();
    scan.onScan({ type: "qr", data: sheet });
    expect(submit).toHaveBeenCalledExactlyOnceWith(sheet);
  });

  it("passes on at most one sheet per scanning session, however many frames arrive", () => {
    const submit = vi.fn();
    const scan = createClaimSheetScan(submit);
    for (let frame = 0; frame < 5; frame += 1) scan.onScan({ type: "qr", data: sheet });
    scan.onScan({ type: "qr", data: `${sheet.slice(0, -4)}AAAA` });
    expect(submit).toHaveBeenCalledOnce();
  });

  it("passes nothing on after it is closed", () => {
    const submit = vi.fn();
    const scan = createClaimSheetScan(submit);
    scan.close();
    scan.onScan({ type: "qr", data: sheet });
    expect(submit).not.toHaveBeenCalled();
  });

  it("starts exactly one claim when the same sheet is scanned twice in quick succession", async () => {
    const h = harness();
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true, killSwitchEngaged: false,
      runtime: h.options, createRuntime: createClaimantRuntimeFoundation });
    const seen: ClaimFlowSnapshot[] = [];
    const flow = createClaimFlow({ handle: bootstrap.claimFlowRuntime(), newKey: randomUUID });
    flow.subscribe((snapshot) => { seen.push(snapshot); });
    const submitted: Promise<void>[] = [];
    const submit = (text: string) => { submitted.push(flow.submit(text)); };
    const first = createClaimSheetScan(submit); const second = createClaimSheetScan(submit);
    first.onScan({ type: "qr", data: sheet }); second.onScan({ type: "qr", data: sheet });
    await Promise.all(submitted);
    expect(seen.map((snapshot) => snapshot.status)).toEqual(["checking", "claim_started"]);
    expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(JSON.stringify(seen)).not.toContain(secret);
    await bootstrap.dispose();
  });

  it("sends a malformed sheet to 'not recognised' without contacting anything", async () => {
    const h = harness();
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true, killSwitchEngaged: false,
      runtime: h.options, createRuntime: createClaimantRuntimeFoundation });
    const flow = createClaimFlow({ handle: bootstrap.claimFlowRuntime(), newKey: randomUUID });
    let pending: Promise<void> = Promise.resolve();
    createClaimSheetScan((text) => { pending = flow.submit(text); }).onScan({ type: "qr", data: "SKQ2.not-a-sheet" });
    await pending;
    expect(flow.snapshot().status).toBe("sheet_not_recognised");
    expect([h.portalSend, h.possessionSend, h.handoffSend].every((mock) => mock.mock.calls.length === 0)).toBe(true);
    await bootstrap.dispose();
  });
});

describe("claim sheet scanner view model", () => {
  it("asks for the camera only when it has not been refused for good", () => {
    expect(claimScannerView(null, true)).toMatchObject({ stage: "checking", requestPermission: false });
    expect(claimScannerView({ granted: false, canAskAgain: true }, true))
      .toMatchObject({ stage: "asking", requestPermission: true, showOpenSettings: false });
    expect(claimScannerView({ granted: false, canAskAgain: false }, true))
      .toMatchObject({ stage: "denied", requestPermission: false, showOpenSettings: true });
  });

  it("shows the camera only while access is granted and the screen is in use", () => {
    expect(claimScannerView({ granted: true, canAskAgain: true }, true))
      .toEqual({ stage: "camera", requestPermission: false, message: claimScannerHelp, showOpenSettings: false });
    expect(claimScannerView({ granted: true, canAskAgain: true }, false).stage).toBe("checking");
  });
});
