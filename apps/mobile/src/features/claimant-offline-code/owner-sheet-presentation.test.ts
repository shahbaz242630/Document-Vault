import createQrCode from "qrcode-generator";
import { describe, expect, it, vi } from "vitest";

import type { OwnerOfflineCodeSheet } from "./owner-offline-code-sheet-factory";
import type { OwnerSheetFlowState } from "./owner-sheet-flow";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { createOwnerSheetFlowHandle, OWNER_SHEET_FLOW_LAUNCH_APPROVED } from "./owner-sheet-runtime";
import { ownerSheetView } from "./owner-sheet-view-model";

vi.mock("expo-print", () => ({ printAsync: vi.fn() }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "60000000-0000-4000-8000-000000000006" }));
vi.mock("@/features/vault", () => ({ useVaultSession: vi.fn() }));
vi.mock("@/shared/api/supabase-client", () => ({ createSupabaseClient: vi.fn() }));

const sheet = { sheetPayload: "SKQ2.eyJzeW50aGV0aWMiOnRydWV9", printedLocator: "SK2-L-ABCD-EFGH",
  printedSecret: "SK2-S-WXYZ-1234", expiresAt: "2027-09-25T09:00:00.000Z",
  registration: { locatorRecordId: "20000000-0000-4000-8000-000000000002" } } as unknown as OwnerOfflineCodeSheet;

describe("owner emergency sheet print layout", () => {
  it("embeds the QR code of exactly the sheet payload with the printed codes and expiry", () => {
    const html = renderOwnerSheetHtml(sheet);
    const expected = createQrCode(0, "M"); expected.addData(sheet.sheetPayload, "Byte"); expected.make();
    expect(html).toContain(expected.createSvgTag({ cellSize: 4, margin: 4, scalable: true }));
    expect(html).toContain("SK2-L-ABCD-EFGH"); expect(html).toContain("SK2-S-WXYZ-1234");
    expect(html).toContain("25 September 2027");
    expect(html).toContain("Start a claim with an emergency sheet");
    expect(html).not.toContain(sheet.sheetPayload);
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org)/u);
  });

  it("escapes printed text", () => {
    const html = renderOwnerSheetHtml({ ...sheet, printedLocator: "<b>&\"'" });
    expect(html).toContain("&lt;b&gt;&amp;&quot;&#39;");
  });
});

describe("owner emergency sheet view", () => {
  const state = (status: OwnerSheetFlowState["status"], changes: Partial<OwnerSheetFlowState> = {}) =>
    ({ status, expiresAt: null, mfaRejected: false, printFailed: false, ...changes });

  it("shows unavailable with no action when there is no flow handle", () => {
    expect(ownerSheetView(null)).toMatchObject({ body: "Emergency sheets aren't available yet.", primary: null,
      secondary: null, showAcknowledgement: false });
  });

  it("walks the owner through acknowledgement, MFA, printing and confirmation", () => {
    expect(ownerSheetView(state("idle"))).toMatchObject({ showAcknowledgement: true,
      primary: { action: "start" } });
    for (const status of ["generating", "registering", "verifying_mfa", "printing"] as const) {
      expect(ownerSheetView(state(status))).toMatchObject({ busy: true, primary: null });
    }
    expect(ownerSheetView(state("needs_fresh_mfa", { mfaRejected: true }))).toMatchObject({ showMfaField: true,
      primary: { action: "submit_mfa" }, notice: { variant: "danger" } });
    expect(ownerSheetView(state("ready_to_print", { printFailed: true }))).toMatchObject({
      primary: { action: "print" }, notice: { title: "Printing didn't finish" } });
    expect(ownerSheetView(state("printed"))).toMatchObject({ showPrintCheck: true, primary: { action: "confirm" },
      secondary: { action: "print" } });
    expect(ownerSheetView(state("done", { expiresAt: "2027-09-25T09:00:00.000Z" })).notice?.message)
      .toBe("It is valid until 25 September 2027.");
    expect(ownerSheetView(state("failed"))).toMatchObject({ primary: { action: "start" },
      notice: { message: "Nothing was printed and no sheet is active." } });
  });
});

describe("owner emergency sheet composition", () => {
  const env = { EXPO_PUBLIC_API_URL: "https://api.test", EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: "https://owner.test" };
  function auth(factorStatus = "verified", verifyError: { message: string } | null = null) {
    return {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "token", user: { id: "owner" } } } })),
      refreshSession: vi.fn(async () => undefined),
      mfa: { listFactors: vi.fn(async () => ({ data: { totp: [{ id: "factor", status: factorStatus }] } })),
        challenge: vi.fn(async () => ({ data: { id: "challenge" }, error: null })),
        verify: vi.fn(async () => ({ data: {}, error: verifyError })) },
    };
  }

  it("is null by default and while configuration is missing, before anything is created", () => {
    expect(OWNER_SHEET_FLOW_LAUNCH_APPROVED).toBe(false);
    const createSheet = vi.fn();
    expect(createOwnerSheetFlowHandle({ createSheet, auth: auth(), env })).toBeNull();
    expect(createOwnerSheetFlowHandle({ approved: true, createSheet, auth: null, env })).toBeNull();
    expect(createOwnerSheetFlowHandle({ approved: true, createSheet, auth: auth(),
      env: { EXPO_PUBLIC_API_URL: env.EXPO_PUBLIC_API_URL } })).toBeNull();
    expect(createSheet).not.toHaveBeenCalled();
  });

  it("steps up with the verified TOTP factor and refreshes the session before retrying", async () => {
    const good = auth();
    const responses = [new Response("{}", { status: 403 }), new Response(JSON.stringify({
      locator_record_id: sheet.registration.locatorRecordId, status: "active", replayed: false }), { status: 200 })];
    const fetchImpl = vi.fn(async () => responses.shift()!);
    const flow = createOwnerSheetFlowHandle({ approved: true, createSheet: vi.fn(async () => sheet), auth: good,
      env, fetch: fetchImpl as unknown as typeof fetch, print: vi.fn(async () => undefined) })!;
    await flow.start();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("12345");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    expect(good.mfa.verify).not.toHaveBeenCalled();
    await flow.submitMfaCode("123456");
    expect(good.mfa.verify).toHaveBeenCalledWith({ challengeId: "challenge", code: "123456", factorId: "factor" });
    expect(good.refreshSession).toHaveBeenCalledTimes(1);
    expect(flow.getState().status).toBe("ready_to_print");

    for (const failing of [auth("unverified"), auth("verified", { message: "bad" })]) {
      const stepUp = createOwnerSheetFlowHandle({ approved: true, createSheet: vi.fn(async () => sheet),
        auth: failing, env, fetch: vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch })!;
      await stepUp.start(); await stepUp.submitMfaCode("123456");
      expect(stepUp.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
      expect(failing.refreshSession).not.toHaveBeenCalled();
    }
  });
});
