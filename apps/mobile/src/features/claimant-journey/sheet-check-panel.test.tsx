import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SheetCheckHandle } from "@/features/claimant-offline-code/sheet-check-runtime";

import { createSheetCheckFlow } from "./sheet-check-flow";

const state = vi.hoisted(() => ({ handle: null as unknown, capture: vi.fn(), scanners: 0 }));

vi.mock("react-native", () => ({ View: ({ children }: { children?: ReactNode }) => createElement("div", null, children) }));
vi.mock("expo-screen-capture", () => ({ usePreventScreenCapture: state.capture }));
vi.mock("@/features/claimant-offline-code/sheet-check-runtime", () => ({ useSheetCheckHandle: () => state.handle }));
vi.mock("./claim-sheet-scanner", () => ({ ClaimSheetScanner: () => { state.scanners += 1; return null; } }));
vi.mock("@/shared/ui", () => {
  const text = ({ children }: { children?: ReactNode }) => createElement("p", null, children);
  const button = ({ label }: { label: string }) => createElement("button", null, label);
  return { BodyText: text, SerifTitle: text, ScreenHeader: () => null, OutlineButton: button, PrimaryButton: button,
    NoticeBox: ({ title, children }: { title: string; children?: ReactNode }) =>
      createElement("section", null, title, children) };
});

const { SheetCheckPanel } = await import("./sheet-check-panel");
const mobile = resolve(__dirname, "../../..");

beforeEach(() => { state.handle = null; state.capture.mockClear(); state.scanners = 0; });

describe("check an emergency sheet screen", () => {
  it("is unavailable outside the Preview build and still blocks screen capture", () => {
    const html = renderToString(createElement(SheetCheckPanel));
    expect(html).toContain("Check an emergency sheet");
    expect(html).toContain("isn&#x27;t available in this app");
    expect(html).not.toContain("Scan the QR code");
    expect(state.capture).toHaveBeenCalled();
  });

  it("offers only the scan button until the claimant chooses to scan", () => {
    const port = { start: vi.fn(), cancel: vi.fn(), dispose: vi.fn() };
    state.handle = { open: () => createSheetCheckFlow({ port, newKey: () => "" }) } satisfies SheetCheckHandle;
    const html = renderToString(createElement(SheetCheckPanel));
    expect(html).toContain("Scan the QR code");
    expect(state.scanners).toBe(0);
    expect(port.start).not.toHaveBeenCalled();
  });

  it("is reached from the route only through the panel, and never reaches the handoff, session or claim", () => {
    const route = readFileSync(resolve(mobile, "app/claim/check-sheet.tsx"), "utf8");
    expect([...route.matchAll(/from "([^"]+)"/gu)].map((match) => match[1]))
      .toEqual(["@/features/claimant-journey/sheet-check-panel", "@/shared/ui"]);
    const reached = importGraph(resolve(mobile, "app/claim/check-sheet.tsx"));
    expect(reached.some((path) => path.endsWith("sheet-check-runtime.ts"))).toBe(true);
    expect(reached.some((path) => path.endsWith("offline-code-v2-lifecycle.ts"))).toBe(true);
    for (const path of reached)
      expect(path).not.toMatch(/claimant-handoff|claimant-session|claim-flow|runtime-(bootstrap|foundation|launch-policy)/u);
  });
});

/** Every local module the file reaches through static imports. */
function importGraph(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(/(?:from|import) "([^"]+)"/gu)) {
      const base = specifier.startsWith("@/") ? resolve(mobile, "src", specifier.slice(2))
        : specifier.startsWith(".") ? resolve(dirname(file), specifier) : null;
      const target = base && [".ts", ".tsx", "/index.ts", "/index.tsx"].map((ext) => base + ext).find(existsSync);
      if (target) visit(target);
    }
  };
  visit(entry);
  return [...seen].map((path) => path.slice(mobile.length + 1));
}
