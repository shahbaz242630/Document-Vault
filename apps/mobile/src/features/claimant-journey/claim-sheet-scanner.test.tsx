import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaimFlowHandle } from "./claim-flow";

const camera = vi.hoisted(() => ({
  permission: null as { granted: boolean; canAskAgain: boolean } | null,
  requestPermission: vi.fn(),
  usePermissions: vi.fn(),
  views: [] as Record<string, unknown>[],
  focused: true,
  appState: "active",
  handle: null as unknown,
}));

vi.mock("react-native", () => {
  const View = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return { View, AppState: { currentState: camera.appState,
    addEventListener: () => ({ remove: () => undefined }) }, Linking: { openSettings: vi.fn() } };
});
vi.mock("expo-camera", () => ({
  CameraView: (props: Record<string, unknown>) => { camera.views.push(props); return createElement("camera"); },
  useCameraPermissions: () => { camera.usePermissions(); return [camera.permission, camera.requestPermission]; },
}));
vi.mock("expo-router", () => ({ useIsFocused: () => camera.focused }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-000000000000" }));
vi.mock("expo-screen-capture", () => ({ usePreventScreenCapture: vi.fn() }));
vi.mock("@/shared/theme/colors", () => ({ colors: { gold: "#b08d57" } }));
vi.mock("@/shared/ui", () => {
  const text = ({ children }: { children?: ReactNode }) => createElement("p", null, children);
  const button = ({ label }: { label: string }) => createElement("button", null, label);
  return { BodyText: text, SerifTitle: text, ScreenHeader: () => null, OutlineButton: button, PrimaryButton: button,
    NoticeBox: ({ title, children }: { title: string; children?: ReactNode }) =>
      createElement("section", null, title, children) };
});
vi.mock("./claim-flow-context", () => ({ useClaimFlowHandle: () => camera.handle }));

const { ClaimFlowPanel } = await import("./claim-flow-panel");
const { ClaimSheetScanner } = await import("./claim-sheet-scanner");

const readyHandle: ClaimFlowHandle = { activatePortal: async () => undefined, start: async () => null,
  isOpen: () => true };

beforeEach(() => {
  camera.permission = { granted: true, canAskAgain: true }; camera.views = []; camera.focused = true;
  camera.handle = null; camera.requestPermission.mockClear(); camera.usePermissions.mockClear();
});

describe("claim screen camera", () => {
  it("never reaches the camera in the normal application, where claims are unavailable", () => {
    const html = renderToString(createElement(ClaimFlowPanel));
    expect(html).toContain("isn&#x27;t available yet");
    expect(html).not.toContain("Scan");
    expect(camera.usePermissions).not.toHaveBeenCalled();
    expect(camera.views).toHaveLength(0);
  });

  it("offers a scan button, not the camera, until the claimant asks to scan", () => {
    camera.handle = readyHandle;
    const html = renderToString(createElement(ClaimFlowPanel));
    expect(html).toContain("Scan the QR code");
    expect(camera.usePermissions).not.toHaveBeenCalled();
    expect(camera.views).toHaveLength(0);
  });

  it("opens the back camera for QR codes only and passes one scanned sheet on", () => {
    const onSheetScanned = vi.fn();
    renderToString(createElement(ClaimSheetScanner, { onSheetScanned, onCancel: vi.fn() }));
    expect(camera.views).toHaveLength(1);
    const [view] = camera.views;
    expect(view).toMatchObject({ barcodeScannerSettings: { barcodeTypes: ["qr"] }, facing: "back", mute: true });
    expect(Object.keys(view!).sort()).toEqual(["active", "barcodeScannerSettings", "facing", "mute",
      "onBarcodeScanned", "style"]);
    const scanned = view!.onBarcodeScanned as (result: { type: string; data: string }) => void;
    scanned({ type: "qr", data: "https://example.test" });
    scanned({ type: "qr", data: "SKQ2.sheet" }); scanned({ type: "qr", data: "SKQ2.sheet" });
    expect(onSheetScanned).toHaveBeenCalledExactlyOnceWith("SKQ2.sheet");
  });

  it("keeps the camera closed when the screen is not in use", () => {
    camera.focused = false;
    renderToString(createElement(ClaimSheetScanner, { onSheetScanned: vi.fn(), onCancel: vi.fn() }));
    expect(camera.views).toHaveLength(0);
  });

  it("keeps the camera closed and points to Settings when access was refused", () => {
    camera.permission = { granted: false, canAskAgain: false };
    const html = renderToString(createElement(ClaimSheetScanner, { onSheetScanned: vi.fn(), onCancel: vi.fn() }));
    expect(camera.views).toHaveLength(0);
    expect(html).toContain("Open Settings");
    expect(camera.requestPermission).not.toHaveBeenCalled();
  });

  it("keeps the camera closed while it is still waiting for access", () => {
    for (const permission of [null, { granted: false, canAskAgain: true }]) {
      camera.permission = permission;
      renderToString(createElement(ClaimSheetScanner, { onSheetScanned: vi.fn(), onCancel: vi.fn() }));
    }
    expect(camera.views).toHaveLength(0);
  });
});
