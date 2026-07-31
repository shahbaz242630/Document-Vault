import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("LockScreen", () => {
  it("offers a password fallback when biometric restoration cannot continue", () => {
    const source = readFileSync(resolve(__dirname, "lock-screen.tsx"), "utf8");

    expect(source).toContain("onUsePassword?: () => void");
    expect(source).toContain("Use password instead");
    expect(source).toContain("onPress={onUsePassword}");
  });
});
