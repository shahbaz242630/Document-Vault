import createQrCode from "qrcode-generator";
import { describe, expect, it, vi } from "vitest";

import type { OwnerSheetCopy } from "./owner-sheet-copy";
import type { OwnerSheetFlowState } from "./owner-sheet-flow";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { createOwnerSheetDetailHandle, createOwnerSheetFlowHandle, OWNER_SHEET_FLOW_LAUNCH_APPROVED }
  from "./owner-sheet-runtime";
import { ownerSheetView } from "./owner-sheet-view-model";

vi.mock("expo-print", () => ({ printAsync: vi.fn(), printToFileAsync: vi.fn() }));
vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));
vi.mock("expo-sharing", () => ({ shareAsync: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "60000000-0000-4000-8000-000000000006" }));
vi.mock("@/features/vault", () => ({ useVaultSession: vi.fn() }));
vi.mock("@/shared/api/supabase-client", () => ({ createSupabaseClient: vi.fn() }));

const sheet = { sheetPayload: "SKQ2.eyJzeW50aGV0aWMiOnRydWV9", printedLocator: "SK2-L-ABCD-EFGH",
  printedSecret: "SK2-S-WXYZ-1234", expiresAt: "2027-09-25T09:00:00.000Z",
  locatorRecordId: "20000000-0000-4000-8000-000000000002" } satisfies OwnerSheetCopy;
const factorySheet = { ...sheet, registration: { locatorRecordId: sheet.locatorRecordId } } as never;

describe("owner emergency sheet PDF layout", () => {
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

describe("owner emergency sheet view (PDF first)", () => {
  const state = (status: OwnerSheetFlowState["status"], changes: Partial<OwnerSheetFlowState> = {}) =>
    ({ status, reference: null, expiresAt: null, mfaRejected: false, saveResult: null, printFailed: false,
      canPickFolder: true, ...changes });

  it("shows unavailable with no action when there is no flow handle", () => {
    expect(ownerSheetView(null)).toMatchObject({ body: "Emergency sheets aren't available yet.", primary: null,
      secondary: [], showAcknowledgement: false });
  });

  it("creates and saves, with printing optional and no print confirmation", () => {
    const idle = ownerSheetView(state("idle"));
    expect(idle).toMatchObject({ title: "Create an emergency sheet", showAcknowledgement: true,
      primary: { label: "Create emergency sheet", action: "start" } });
    expect(idle.body).toContain("save it as a PDF");
    expect(idle.body).toContain("This PDF can unlock your vault");
    for (const status of ["generating", "registering", "verifying_mfa", "storing", "saving", "printing"] as const) {
      expect(ownerSheetView(state(status))).toMatchObject({ busy: true, primary: null });
    }
    expect(ownerSheetView(state("needs_fresh_mfa", { mfaRejected: true }))).toMatchObject({ showMfaField: true,
      primary: { action: "submit_mfa" }, notice: { variant: "danger" } });
    const ready = ownerSheetView(state("ready", { reference: "200000", expiresAt: "2027-09-25T09:00:00.000Z" }));
    expect(ready).toMatchObject({ primary: { label: "Save PDF", action: "save" }, notice: null });
    expect(ready.secondary.map((entry) => entry.action)).toEqual(["share", "print", "open_list"]);
    expect(ready.body).toBe("Sheet 200000 is active until 25 September 2027. Save it as a PDF now. You can open it "
      + "and save it again any time from My emergency sheets.");
    expect(ownerSheetView(state("ready", { canPickFolder: false })).secondary.map((entry) => entry.action))
      .toEqual(["print", "open_list"]);
    expect(JSON.stringify(Object.values({ idle, ready }))).not.toMatch(/sharp|Confirm sheet printed|cancelled\./u);
    expect(ownerSheetView(state("failed"))).toMatchObject({ primary: { action: "start" },
      notice: { message: "Nothing was saved and no sheet is active." } });
  });

  it("explains every save outcome without claiming a save the platform can't prove", () => {
    const notice = (saveResult: OwnerSheetFlowState["saveResult"]) => ownerSheetView(state("ready", { saveResult })).notice;
    expect(notice({ status: "saved", fileName: "Sanduqkin-emergency-sheet-200000.pdf", folder: "Download" }))
      .toEqual({ variant: "success", title: "PDF saved",
        message: "Saved as Sanduqkin-emergency-sheet-200000.pdf in Download." });
    expect(notice({ status: "shared", fileName: "x.pdf" })).toMatchObject({ title: "Save dialog closed",
      message: expect.stringContaining("We can't confirm where it was saved") });
    expect(notice({ status: "cancelled" })).toMatchObject({ title: "Not saved",
      message: expect.stringContaining("still active") });
    expect(notice({ status: "failed" })).toMatchObject({ title: "Couldn't save the PDF" });
    expect(ownerSheetView(state("ready", { printFailed: true })).notice).toMatchObject({ title: "Printing didn't finish" });
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

  const sealer = { seal: vi.fn(), open: vi.fn() };
  const copies = { save: vi.fn(async () => undefined), load: vi.fn(), remove: vi.fn() };
  const exporter = { canPickFolder: true, save: vi.fn(), print: vi.fn() };

  it("is null by default and while configuration is missing, before anything is created", () => {
    expect(OWNER_SHEET_FLOW_LAUNCH_APPROVED).toBe(false);
    const createSheet = vi.fn();
    expect(createOwnerSheetFlowHandle({ createSheet, sealer, auth: auth(), env })).toBeNull();
    expect(createOwnerSheetFlowHandle({ approved: true, createSheet, sealer, auth: null, env })).toBeNull();
    expect(createOwnerSheetFlowHandle({ approved: true, createSheet, sealer, auth: auth(),
      env: { EXPO_PUBLIC_API_URL: env.EXPO_PUBLIC_API_URL } })).toBeNull();
    expect(createOwnerSheetDetailHandle({ locatorRecordId: sheet.locatorRecordId, sealer, isLocked: () => false,
      auth: auth(), env })).toBeNull();
    expect(createSheet).not.toHaveBeenCalled();
  });

  it("steps up with the verified TOTP factor and refreshes the session before retrying", async () => {
    const good = auth();
    const responses = [new Response("{}", { status: 403 }), new Response(JSON.stringify({
      locator_record_id: sheet.locatorRecordId, status: "active", replayed: false }), { status: 200 })];
    const activations: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      if (!url.endsWith("/owner/session/activate")) return responses.shift()!;
      activations.push(url);
      return new Response(JSON.stringify({ session_version: 1, replayed: false }), { status: 200 });
    });
    const flow = createOwnerSheetFlowHandle({ approved: true, createSheet: vi.fn(async () => factorySheet), sealer,
      auth: good, env, fetch: fetchImpl as unknown as typeof fetch, copies, exporter })!;
    await flow.start();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("12345");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    expect(good.mfa.verify).not.toHaveBeenCalled();
    await flow.submitMfaCode("123456");
    expect(good.mfa.verify).toHaveBeenCalledWith({ challengeId: "challenge", code: "123456", factorId: "factor" });
    expect(good.refreshSession).toHaveBeenCalledTimes(1);
    // W2a: the fresh TOTP check also activates the owner's claimant session control before the retry.
    expect(activations).toEqual(["https://api.test/owner/session/activate"]);
    expect(flow.getState().status).toBe("ready");
    expect(copies.save).toHaveBeenCalledOnce();

    for (const failing of [auth("unverified"), auth("verified", { message: "bad" })]) {
      const stepUp = createOwnerSheetFlowHandle({ approved: true, createSheet: vi.fn(async () => factorySheet), sealer,
        auth: failing, env, fetch: vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch,
        copies, exporter })!;
      await stepUp.start(); await stepUp.submitMfaCode("123456");
      expect(stepUp.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
      expect(failing.refreshSession).not.toHaveBeenCalled();
    }
  });
});
