import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("ResetPasswordPanel", () => {
  it("protects recovery input from screenshots and exposes stable automation labels", () => {
    const source = readFileSync(resolve(__dirname, "reset-password-panel.tsx"), "utf8");

    expect(source).toContain("usePreventScreenCapture");
    expect(source).toContain('accessibilityLabel="Recovery phrase input"');
    expect(source).toContain('accessibilityLabel="New password input"');
    expect(source).toContain('accessibilityLabel="Confirm new password input"');
  });
});
