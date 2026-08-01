import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("BiometricPreferencesPanel interaction", () => {
  it("makes the card an accessible button wired to the preference action", () => {
    const source = readFileSync(
      resolve(__dirname, "biometric-preferences-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("<Pressable");
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain("accessibilityLabel={control.label}");
    expect(source).toContain("accessibilityState={{");
    expect(source).toContain("runBiometricPreferenceAction({");
    expect(source).toContain("onDisable: preferences.disable");
    expect(source).toContain("onEnable: preferences.enable");
  });
});
